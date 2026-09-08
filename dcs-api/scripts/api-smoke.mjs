#!/usr/bin/env node
/**
 * Live end-to-end smoke test of every DCS API endpoint.
 * Requires the DCS server running on 8080 (default).
 *
 * Usage: node scripts/api-smoke.mjs [baseUrl]
 */
import crypto from 'node:crypto';

const BASE = process.argv[2] || 'http://127.0.0.1:8080';

// Test tenant (test bank, fail_open)
const X_TENANT_KEY = 'test-api-key-0001';
const SIGNING_SECRET = 'test-signing-key-0001';
// Test MNO (fail_closed) - used for its specific persistence checks if needed
const MNO_KEY = 'mno-api-key-0002';
const MNO_SIGNING = 'mno-signing-key-0002';
const OPS = 'Bearer ops-secret-token-0001';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    failures.push({ name, detail: detail ?? '' });
    console.log(`FAIL  ${name}  ${detail ?? ''}`);
  }
}

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* no json */
  }
  return { status: res.status, headers: res.headers, body };
}

function sign(method, path, payload, secret = SIGNING_SECRET, key = X_TENANT_KEY, nonce = crypto.randomUUID()) {
  const timestamp = String(Date.now());
  const body = payload ? JSON.stringify(payload) : '';
  const urlPath = path.split('?')[0];
  const query = path.split('?')[1] || '';
  const input = [timestamp, method, urlPath, query, body].join('.');
  const signature = crypto.createHmac('sha256', secret).update(input).digest('hex');
  return {
    'x-tenant-key': key,
    'x-timestamp': timestamp,
    'x-nonce': nonce,
    'x-signature': signature,
    'content-type': 'application/json',
  };
}

const stamp = Date.now();
const recipient = '255712345678';
const recipient2 = '255712345679';

console.log('=== DCS API smoke test ===\n');

// 1. Health (unauthenticated)
{
  const r = await api('/v1/health');
  check('GET /v1/health operational', r.status === 200 && r.body.status === 'operational', `${r.status}`);
}

// 2. Unsigned request rejected
{
  const r = await api('/v1/recipients/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ recipient_external_ref: recipient, channel: 'mobile_money', tenant_txn_ref: `S-${stamp}` }),
  });
  check('unsigned request -> 401', r.status === 401, JSON.stringify(r.body));
}

// 3. Stale timestamp rejected
{
  const ts = String(Date.now() - 10 * 60 * 1000);
  const input = [ts, 'POST', '/v1/recipients/verify', '', ''].join('.');
  const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(input).digest('hex');
  const r = await api('/v1/recipients/verify', {
    method: 'POST',
    headers: {
      'x-tenant-key': X_TENANT_KEY, 'x-timestamp': ts, 'x-nonce': crypto.randomUUID(),
      'x-signature': sig, 'content-type': 'application/json',
    },
    body: JSON.stringify({ recipient_external_ref: recipient, channel: 'mobile_money', tenant_txn_ref: `S-${stamp}` }),
  });
  check('stale timestamp -> 401', r.status === 401, JSON.stringify(r.body));
}

// 4. Replay rejected (same nonce twice)
{
  const nonce = crypto.randomUUID();
  const payload = { recipient_external_ref: recipient, channel: 'mobile_money', tenant_txn_ref: `REPLAY-${stamp}` };
  let r = await api('/v1/recipients/verify', {
    method: 'POST', headers: sign('POST', '/v1/recipients/verify', payload, SIGNING_SECRET, X_TENANT_KEY, nonce), body: JSON.stringify(payload),
  });
  check('first use of nonce -> 200', r.status === 200, `${r.status}`);
  r = await api('/v1/recipients/verify', {
    method: 'POST', headers: sign('POST', '/v1/recipients/verify', payload, SIGNING_SECRET, X_TENANT_KEY, nonce), body: JSON.stringify(payload),
  });
  check('replayed nonce -> 409', r.status === 409 && r.body.error === 'replay_detected', JSON.stringify(r.body));
}

// 5. Recipient verification
{
  const payload = { recipient_external_ref: recipient2, channel: 'mobile_money', tenant_txn_ref: `V-${stamp}` };
  const r = await api('/v1/recipients/verify', { method: 'POST', headers: sign('POST', '/v1/recipients/verify', payload), body: JSON.stringify(payload) });
  check('POST /v1/recipients/verify verified', r.status === 200 && r.body.verified === true, JSON.stringify(r.body));
  check('  masked name present', typeof r.body.recipient_display_name === 'string' && r.body.recipient_display_name.includes('*'), `${r.body.recipient_display_name}`);
  check('  young account flagged', r.body.account_age_days < 30, `age=${r.body.account_age_days}`);
}

// 6. Transaction validate (known recipient, known device)
{
  const payload = {
    tenant_txn_ref: `TX-ALLOW-${stamp}`,
    user_external_ref: `user-a-${stamp}`,
    amount: 80000,
    currency: 'TZS',
    channel: 'mobile_money',
    recipient_external_ref: recipient,
    device_fingerprint: 'device-A',
    occurred_at: new Date().toISOString(),
  };
  const r = await api('/v1/transactions/validate', { method: 'POST', headers: sign('POST', '/v1/transactions/validate', payload), body: JSON.stringify(payload) });
  check('POST /v1/transactions/validate -> 200 decision', r.status === 200 && ['allow', 'warn'].includes(r.body.decision), JSON.stringify(r.body).slice(0, 200));
  const txnId = r.body.transaction_id;
  check('  transaction_id returned', !!txnId, `${txnId}`);

  // 7. Transaction lookup
  const g = await api(`/v1/transactions/${txnId}`, { headers: sign('GET', `/v1/transactions/${txnId}`) });
  check('GET /v1/transactions/:id returns decision', g.status === 200 && g.body.decision === r.body.decision, JSON.stringify(g.body));
}

// 8. Velocity + device change -> HOLD on 6th txn in the hour
async function buildHold(userRef, refBase, deviceA = 'device-X', deviceB = 'device-Y') {
  const base = {
    user_external_ref: userRef,
    amount: 5000,
    currency: 'TZS',
    channel: 'mobile_money',
    recipient_external_ref: recipient,
    device_fingerprint: deviceA,
    occurred_at: new Date().toISOString(),
  };
  let r;
  for (let i = 0; i < 6; i++) {
    const txn = {
      ...base,
      tenant_txn_ref: `${refBase}-${i}-${stamp}`,
      device_fingerprint: i === 5 ? deviceB : deviceA,
    };
    r = await api('/v1/transactions/validate', { method: 'POST', headers: sign('POST', '/v1/transactions/validate', txn), body: JSON.stringify(txn) });
  }
  return r;
}

{
  let r = await buildHold(`user-hold-${stamp}`, 'TX-HOLD');
  check('device change on 6th txn -> HOLD', r.body?.decision === 'hold', `${r.body?.decision} score=${r.body?.risk_score} codes=${(r.body?.reason_codes || []).join(',')}`);
  check('  velocity + device signals fire', (r.body?.reason_codes || []).includes('HIGH_TXN_VELOCITY') && (r.body?.reason_codes || []).includes('DEVICE_CHANGE'), `${(r.body?.reason_codes || []).join(',')}`);
  const holdId = r.body?.hold?.hold_id;
  check('  hold_id returned in response', !!holdId, `${holdId}`);

  if (holdId) {
    // 9a. Freeze hold (ops)
    const f = await api(`/v1/holds/${holdId}/freeze`, { method: 'POST', headers: { authorization: OPS } });
    check('POST /v1/holds/:id/freeze -> frozen', f.status === 200 && f.body.status === 'frozen', JSON.stringify(f.body));

    // 9b. Releasing a frozen hold must be blocked (investigation guard)
    const blocked = await api(`/v1/holds/${holdId}/release`, {
      method: 'POST',
      headers: sign('POST', `/v1/holds/${holdId}/release`, { note: 'should not work' }),
      body: JSON.stringify({ note: 'should not work' }),
    });
    check('release of frozen hold -> 409 conflict', blocked.status === 409, JSON.stringify(blocked.body));

    // 10. File dispute (tenant-signed)
    const dp = await api('/v1/disputes', {
      method: 'POST',
      headers: sign('POST', '/v1/disputes', { hold_id: holdId, reason: 'Customer did not authorize this transfer (simulated).' }),
      body: JSON.stringify({ hold_id: holdId, reason: 'Customer did not authorize this transfer (simulated).' }),
    });
    check('POST /v1/disputes -> 201', dp.status === 201 && !!dp.body.dispute_id, JSON.stringify(dp.body).slice(0, 160));
    const disputeId = dp.body.dispute_id;

    // 11. Resolve dispute (ops)
    if (disputeId) {
      const rd = await api(`/v1/disputes/${disputeId}`, {
        method: 'PATCH',
        headers: { authorization: OPS, 'content-type': 'application/json' },
        body: JSON.stringify({ outcome: 'approved', note: 'Simulated approval after investigation.' }),
      });
      check('PATCH /v1/disputes/:id -> approved', rd.status === 200 && rd.body.outcome === 'approved', JSON.stringify(rd.body));
    }
  }

  // 13. Clean release path on a separate hold (no freeze/dispute)
  const r2 = await buildHold(`user-rel-${stamp}`, 'TX-REL', 'device-P', 'device-Q');
  if (r2.body?.hold?.hold_id) {
    const rel = await api(`/v1/holds/${r2.body.hold.hold_id}/release`, {
      method: 'POST',
      headers: sign('POST', `/v1/holds/${r2.body.hold.hold_id}/release`, { note: `Simulated release ${stamp}` }),
      body: JSON.stringify({ note: `Simulated release ${stamp}` }),
    });
    check('POST /v1/holds/:id/release -> released', rel.status === 200 && ['released', 'resolved'].includes(rel.body.status), JSON.stringify(rel.body));
  } else {
    check('POST /v1/holds/:id/release -> released', false, 'second hold not created');
  }
}

// 14. Webhook subscribe (tenant-signed)
{
  const payload = { callback_url: `https://hooks.example.com/dcs/${stamp}`, events: ['HOLD_CREATED'] };
  const r = await api('/v1/webhooks/subscribe', { method: 'POST', headers: sign('POST', '/v1/webhooks/subscribe', payload), body: JSON.stringify(payload) });
  check('POST /v1/webhooks/subscribe -> active', r.status === 200 && r.body.status === 'active', JSON.stringify(r.body).slice(0, 160));
}

// 15. Audit chain verify (ops)
{
  const r = await api('/v1/audit/verify/tenant-test-0001', { headers: { authorization: OPS } });
  check('GET /v1/audit/verify/:tenantId -> valid chain', r.status === 200 && r.body.valid === true, JSON.stringify(r.body));
}

// 16. Tenant isolation: MNO cannot read bank's transaction
{
  const payload = {
    tenant_txn_ref: `TX-ISO-${stamp}`,
    user_external_ref: `user-iso-${stamp}`,
    amount: 12000,
    currency: 'TZS',
    channel: 'bank',
    recipient_external_ref: recipient,
    occurred_at: new Date().toISOString(),
  };
  const posted = await api('/v1/transactions/validate', { method: 'POST', headers: sign('POST', '/v1/transactions/validate', payload), body: JSON.stringify(payload) });
  if (posted.body.transaction_id) {
    const g = await api(`/v1/transactions/${posted.body.transaction_id}`, { headers: sign('GET', `/v1/transactions/${posted.body.transaction_id}`, undefined, MNO_SIGNING, MNO_KEY) });
    check('cross-tenant lookup -> 404', g.status === 404, `${g.status} ${g.body?.error || ''}`);
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed) {
  console.log(failures.map((f) => `  - ${f.name}: ${f.detail}`).join('\n'));
  process.exit(1);
}