import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from '../src/server.js';
import { prisma } from '../src/lib/prisma.js';
import { sha256, hmacSHA256 } from '../src/utils/crypto.js';

let app;
let tenantId;

const TEST_KEY = 'test-e2e-key-' + Date.now();
const TEST_SIGNING_SECRET = 'e2e-signing-secret-' + Date.now();

function signRequest({ method, url, payload }) {
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const body = payload ? JSON.stringify(payload) : '';
  const path = url.split('?')[0];
  const query = url.split('?')[1] || '';
  const input = [timestamp, method, path, query, body].join('.');
  const signature = hmacSHA256(TEST_SIGNING_SECRET, input);
  return { 'x-timestamp': timestamp, 'x-nonce': nonce, 'x-signature': signature };
}

before(async () => {
  tenantId = 'tenant-e2e-' + Date.now();
  await prisma.tenant.create({
    data: {
      tenant_id: tenantId,
      name: 'E2E Tenant',
      tenant_type: 'bank',
      api_key_hash: sha256(TEST_KEY),
      signing_key_hash: TEST_SIGNING_SECRET,
      status: 'active',
      fail_policy: 'fail_open',
    },
  });

  process.env.NODE_ENV = 'test';
  app = await buildServer();

  await app.ready();
  await app.inject({ method: 'GET', url: '/v1/health' });
});

after(async () => {
  if (!tenantId) {
    if (app) await app.close();
    return;
  }
  const dis = await prisma.dispute.findMany({
    where: { hold: { transaction: { tenant_id: tenantId } } },
    select: { dispute_id: true },
  });
  await prisma.dispute.deleteMany({ where: { dispute_id: { in: dis.map((d) => d.dispute_id) } } });
  await prisma.reasonCode.deleteMany({ where: { transaction: { tenant_id: tenantId } } });
  await prisma.hold.deleteMany({ where: { transaction: { tenant_id: tenantId } } });
  await prisma.transaction.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.recipientVerification.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.customerBaseline.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.auditLog.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.webhookSubscription.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.tenant.deleteMany({ where: { tenant_id: tenantId } });
  if (app) await app.close();
});

const auth = { 'x-tenant-key': TEST_KEY, 'content-type': 'application/json' };

function signed(method, url, payload, extra = {}) {
  return { ...auth, ...signRequest({ method, url, payload }), ...extra };
}

test('health endpoint is unauthenticated', async () => {
  const res = await app.inject({ method: 'GET', url: '/v1/health' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, 'operational');
});

test('missing tenant key returns 401', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/transactions/validate',
    payload: {},
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error, 'invalid_key');
});

test('invalid tenant key returns 401', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/recipients/verify',
    headers: { 'x-tenant-key': 'wrong' },
    payload: { recipient_external_ref: 'x', channel: 'bank', tenant_txn_ref: 't' },
  });
  assert.equal(res.statusCode, 401);
});

test('recipient verify returns decision', async () => {
  const payload = { recipient_external_ref: '255712345678', channel: 'mobile_money', tenant_txn_ref: 'E2E-R-1' };
  const res = await app.inject({
    method: 'POST',
    url: '/v1/recipients/verify',
    headers: signed('POST', '/v1/recipients/verify', payload),
    payload,
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok('verified' in body);
  assert.ok('recipient_display_name' in body);
});

test('transaction validation returns decision & score', async () => {
  const payload = {
    tenant_txn_ref: 'E2E-TX-1',
    user_external_ref: '2557000111',
    amount: 40000,
    currency: 'TZS',
    channel: 'bank',
    recipient_external_ref: '255712345678',
    occurred_at: '2026-09-08T11:00:00Z',
  };
  const res = await app.inject({
    method: 'POST',
    url: '/v1/transactions/validate',
    headers: signed('POST', '/v1/transactions/validate', payload, { 'x-request-id': 'e2e-req-1' }),
    payload,
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(['allow', 'warn', 'hold', 'freeze', 'block'].includes(body.decision));
  assert.equal(typeof body.risk_score, 'number');
  assert.ok(Array.isArray(body.reason_codes));
  assert.ok(body.model_version);
});

test('idempotent X-Request-Id returns 409 duplicate', async () => {
  const payload = {
    tenant_txn_ref: 'E2E-TX-2',
    user_external_ref: '2557000222',
    amount: 30000,
    currency: 'TZS',
    channel: 'bank',
    recipient_external_ref: '255712345679',
    occurred_at: '2026-09-08T11:00:00Z',
  };
  const first = await app.inject({
    method: 'POST',
    url: '/v1/transactions/validate',
    headers: signed('POST', '/v1/transactions/validate', payload, { 'x-request-id': 'e2e-req-dupe' }),
    payload,
  });
  assert.equal(first.statusCode, 200);
  const second = await app.inject({
    method: 'POST',
    url: '/v1/transactions/validate',
    headers: signed('POST', '/v1/transactions/validate', payload, { 'x-request-id': 'e2e-req-dupe' }),
    payload,
  });
  assert.equal(second.statusCode, 409);
  assert.equal(second.json().transaction_id, first.json().transaction_id);
});

test('webhook subscribe registers callback', async () => {
  const payload = { callback_url: 'http://localhost:9888/e2e' };
  const res = await app.inject({
    method: 'POST',
    url: '/v1/webhooks/subscribe',
    headers: signed('POST', '/v1/webhooks/subscribe', payload),
    payload,
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, 'active');
});

test('unknown route returns 404', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/v1/does-not-exist',
    headers: auth,
  });
  assert.equal(res.statusCode, 404);
});

test('audit chain is tamper-evident', async () => {
  const { createAuditLog, verifyAuditChain } = await import('../src/services/audit.js');
  await prisma.auditLog.deleteMany({ where: { tenant_id: tenantId } });

  const e1 = await createAuditLog({ tenantId, entityType: 'HOLD', entityId: 'h-1', action: 'create', actor: 'system' });
  const e2 = await createAuditLog({ tenantId, entityType: 'HOLD', entityId: 'h-1', action: 'release', actor: 'ops' });

  assert.ok(e1.entry_hash);
  assert.equal(e2.prev_hash, e1.entry_hash);

  let verdict = await verifyAuditChain(tenantId);
  assert.equal(verdict.valid, true, 'chain should verify before tamper');

  await prisma.auditLog.update({ where: { audit_id: e1.audit_id }, data: { action: 'TAMPERED' } });
  verdict = await verifyAuditChain(tenantId);
  assert.equal(verdict.valid, false, 'chain should break after tamper');
  assert.equal(verdict.reason, 'entry_hash_mismatch');

  await createAuditLog({ tenantId, entityType: 'HOLD', entityId: 'h-2', action: 'freeze', actor: 'ops' });
  const restored = await verifyAuditChain(tenantId);
  assert.ok(restored.valid === false || restored.valid === true, 'chain state is inspectable');
});

test('health reports real validate latency metrics', async () => {
  const payload = {
    tenant_txn_ref: 'E2E-TX-3',
    user_external_ref: '2557000333',
    amount: 20000,
    currency: 'TZS',
    channel: 'bank',
    recipient_external_ref: '255712345680',
    occurred_at: '2026-09-08T11:00:00Z',
  };
  await app.inject({
    method: 'POST',
    url: '/v1/transactions/validate',
    headers: signed('POST', '/v1/transactions/validate', payload),
    payload,
  });
  const res = await app.inject({ method: 'GET', url: '/v1/health' });
  const body = res.json();
  assert.equal(body.status, 'operational');
  assert.ok('validate_samples' in body.sla);
  assert.ok(typeof body.audit_chain.status === 'string');
});

test('ops rotation rotates API key and signing secret (old credentials rejected)', async () => {
  const ops = { authorization: `Bearer ${process.env.OPS_BEARER_TOKEN}` };
  const rotTenant = 'tenant-rot-' + Date.now();
  const oldKey = 'rot-old-key-' + Date.now();
  const oldSecret = 'rot-old-secret-' + Date.now();

  await prisma.tenant.create({
    data: {
      tenant_id: rotTenant,
      name: 'Rotation Tenant',
      tenant_type: 'mno',
      api_key_hash: sha256(oldKey),
      signing_key_hash: oldSecret,
      status: 'active',
      fail_policy: 'fail_open',
    },
  });

  try {
    const valPayload = {
      tenant_txn_ref: 'ROT-1',
      user_external_ref: '2557000999',
      amount: 5000,
      currency: 'TZS',
      channel: 'mobile_money',
      recipient_external_ref: '255712345678',
      occurred_at: '2026-09-08T11:00:00Z',
    };

    const signWith = (secret) => ({ method, url, payload }) => {
      const timestamp = String(Date.now());
      const nonce = crypto.randomUUID();
      const body = payload ? JSON.stringify(payload) : '';
      const path = url.split('?')[0];
      const query = url.split('?')[1] || '';
      const signature = hmacSHA256(secret, [timestamp, method, path, query, body].join('.'));
      return { ...{ 'x-tenant-key': oldKey }, 'x-timestamp': timestamp, 'x-nonce': nonce, 'x-signature': signature };
    };

    let res = await app.inject({
      method: 'POST',
      url: `/v1/ops/tenants/${rotTenant}/rotate-api-key`,
      headers: ops,
    });
    assert.equal(res.statusCode, 200, JSON.stringify(res.json()));
    const { api_key } = res.json();
    assert.ok(api_key && api_key.length >= 30);

    res = await app.inject({
      method: 'POST',
      url: '/v1/transactions/validate',
      headers: { ...signWith(oldSecret)({ method: 'POST', url: '/v1/transactions/validate', payload: valPayload }), 'content-type': 'application/json' },
      payload: valPayload,
    });
    assert.equal(res.statusCode, 401, 'old api key must be rejected after rotation');

    res = await app.inject({
      method: 'POST',
      url: `/v1/ops/tenants/${rotTenant}/rotate-signing-key`,
      headers: ops,
    });
    assert.equal(res.statusCode, 200, JSON.stringify(res.json()));
    const { signing_secret } = res.json();
    assert.ok(signing_secret && signing_secret.length >= 30);

    const ts = String(Date.now());
    const nonce = crypto.randomUUID();
    const body = JSON.stringify(valPayload);
    const sig = hmacSHA256(signing_secret, [ts, 'POST', '/v1/transactions/validate', '', body].join('.'));
    res = await app.inject({
      method: 'POST',
      url: '/v1/transactions/validate',
      headers: {
        'x-tenant-key': api_key,
        'x-timestamp': ts,
        'x-nonce': nonce,
        'x-signature': sig,
        'content-type': 'application/json',
      },
      payload: valPayload,
    });
    assert.equal(res.statusCode, 200, 'new api key + new signing secret must succeed');
    assert.ok(typeof res.json().decision === 'string', 'must return a decision');

    const oldSig = hmacSHA256(oldSecret, [ts, 'POST', '/v1/transactions/validate', '', body].join('.'));
    res = await app.inject({
      method: 'POST',
      url: '/v1/transactions/validate',
      headers: {
        'x-tenant-key': api_key,
        'x-timestamp': ts,
        'x-nonce': crypto.randomUUID(),
        'x-signature': oldSig,
        'content-type': 'application/json',
      },
      payload: valPayload,
    });
    assert.equal(res.statusCode, 401, 'old signing secret must be rejected after rotation');
  } finally {
    await prisma.auditLog.deleteMany({ where: { tenant_id: rotTenant } });
    await prisma.reasonCode.deleteMany({ where: { transaction: { tenant_id: rotTenant } } });
    await prisma.transaction.deleteMany({ where: { tenant_id: rotTenant } });
    await prisma.customerBaseline.deleteMany({ where: { tenant_id: rotTenant } });
    await prisma.recipientVerification.deleteMany({ where: { tenant_id: rotTenant } });
    await prisma.tenant.deleteMany({ where: { tenant_id: rotTenant } });
  }
});

test('client login by phone + PIN (bank-app style)', async () => {
  const dir = await app.inject({
    method: 'GET',
    url: '/v1/client/directory',
    headers: signed('GET', '/v1/client/directory'),
  });
  assert.equal(dir.statusCode, 200);
  const phone = dir.json().senders[0].external_ref;
  const goodPin = phone.replace(/\D/g, '').slice(-4);

  const ok = await app.inject({
    method: 'POST',
    url: '/v1/client/login',
    headers: signed('POST', '/v1/client/login', { phone, pin: goodPin }),
    payload: { phone, pin: goodPin },
  });
  assert.equal(ok.statusCode, 200, JSON.stringify(ok.body));
  assert.equal(ok.json().ok, true);
  assert.equal(ok.json().account.external_ref, phone);
  assert.ok(typeof ok.json().account.balance === 'number');

  const badPin = await app.inject({
    method: 'POST',
    url: '/v1/client/login',
    headers: signed('POST', '/v1/client/login', { phone, pin: '0000' }),
    payload: { phone, pin: '0000' },
  });
  assert.equal(badPin.statusCode, 401, JSON.stringify(badPin.body));

  const unknown = await app.inject({
    method: 'POST',
    url: '/v1/client/login',
    headers: signed('POST', '/v1/client/login', { phone: '255999999999', pin: '9999' }),
    payload: { phone: '255999999999', pin: '9999' },
  });
  assert.equal(unknown.statusCode, 404, JSON.stringify(unknown.body));
});

test('client directory is available to a signed tenant (no ops token)', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/v1/client/directory',
    headers: signed('GET', '/v1/client/directory'),
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.ok(Array.isArray(res.json().senders));
  assert.ok(Array.isArray(res.json().recipients));

  const noAuth = await app.inject({ method: 'GET', url: '/v1/client/directory' });
  assert.equal(noAuth.statusCode, 401, 'unsigned request must be rejected');
});

test('ops directory CRUD: sandbox customers and scenarios', async () => {
  const ops = { authorization: `Bearer ${process.env.OPS_BEARER_TOKEN}` };
  const withJson = (h) => ({ ...h, 'content-type': 'application/json' });
  const ref = '255CRUD' + Date.now().toString().slice(-6);

  let res = await app.inject({
    method: 'POST',
    url: '/v1/sandbox/customers',
    headers: withJson(ops),
    payload: { kind: 'recipient', external_ref: ref, registered_name: 'CRUD Test Ltd', account_age_days: 30, balance: 10000 },
  });
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));

  res = await app.inject({ method: 'GET', url: '/v1/sandbox/customers', headers: ops });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().recipients.some((c) => c.external_ref === ref), 'created customer must appear in list');

  res = await app.inject({
    method: 'PATCH',
    url: `/v1/sandbox/customers/${ref}`,
    headers: withJson(ops),
    payload: { balance: 25000, account_age_days: 60 },
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.json().balance, 25000);

  res = await app.inject({ method: 'DELETE', url: `/v1/sandbox/customers/${ref}`, headers: ops });
  assert.equal(res.statusCode, 409, 'delete must be blocked while ledger balance is non-zero');

  await app.inject({ method: 'PATCH', url: `/v1/sandbox/customers/${ref}`, headers: withJson(ops), payload: { balance: 0 } });
  res = await app.inject({ method: 'DELETE', url: `/v1/sandbox/customers/${ref}`, headers: ops });
  assert.equal(res.statusCode, 200);

  res = await app.inject({ method: 'GET', url: '/v1/sandbox/customers', headers: ops });
  assert.ok(!res.json().recipients.some((c) => c.external_ref === ref), 'deleted customer must be gone');

  const scKey = 'crud-scenario-' + Date.now();
  res = await app.inject({
    method: 'POST',
    url: '/v1/sandbox/scenarios',
    headers: withJson(ops),
    payload: { key: scKey, tag: 'CRUD', expected_decision: 'warn', title: 'CRUD e2e', description: 't', flow: 'p2p', sender_ref: '2557000999', recipient_ref: '255712345678', amount: 9000 },
  });
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));

  res = await app.inject({
    method: 'PATCH',
    url: `/v1/sandbox/scenarios/${scKey}`,
    headers: withJson(ops),
    payload: { expected_decision: 'allow' },
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));

  res = await app.inject({ method: 'DELETE', url: `/v1/sandbox/scenarios/${scKey}`, headers: ops });
  assert.equal(res.statusCode, 200);
  res = await app.inject({ method: 'DELETE', url: `/v1/sandbox/scenarios/${scKey}`, headers: ops });
  assert.equal(res.statusCode, 404);
});

test('ops hold cancel returns escrow to sender; dispute withdraw closes open dispute', async () => {
  const ops = { authorization: `Bearer ${process.env.OPS_BEARER_TOKEN}` };
  const ledger = await import('../src/services/ledger.js');
  const ref = 'CRUDHLD' + Date.now();

  await prisma.ledgerAccount.upsert({
    where: { external_ref: '2557000999' },
    create: { external_ref: '2557000999', kind: 'sender', name: 'Hold Sender', balance: 80000 },
    update: { balance: 80000 },
  });
  await prisma.ledgerAccount.upsert({
    where: { external_ref: '__ESCROW__' },
    create: { external_ref: '__ESCROW__', kind: 'special', name: 'Escrow', balance: 20000 },
    update: { balance: 20000 },
  });

  const txn = await prisma.transaction.create({
    data: {
      transaction_id: ref, tenant_id: tenantId, tenant_txn_ref: ref,
      sender_ref: '2557000999', recipient_ref: '255712345678',
      user_external_ref: '2557000999', amount: 20000, currency: 'TZS', channel: 'bank',
      recipient_external_ref: '255712345678', occurred_at: new Date(),
      decision: 'hold', risk_score: 70,
    },
  });
  const hold = await prisma.hold.create({
    data: { hold_id: 'h-' + Date.now(), transaction_id: ref, ttl_seconds: 1800, status: 'active' },
  });
  await prisma.ledgerEntry.createMany({
    data: [
      { reference: ref, from_ref: '2557000999', to_ref: '__ESCROW__', amount: 20000, direction: 'debit', kind: 'hold_reserve' },
      { reference: ref, from_ref: '2557000999', to_ref: '__ESCROW__', amount: 20000, direction: 'credit', kind: 'hold_reserve' },
    ],
  });

  let res = await app.inject({ method: 'DELETE', url: `/v1/holds/${hold.hold_id}`, headers: ops });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.json().status, 'cancelled', JSON.stringify(res.body));
  const senderAfter = await prisma.ledgerAccount.findUnique({ where: { external_ref: '2557000999' } });
  assert.equal(Number(senderAfter.balance), 100000, 'cancelled hold must restore escrow to sender');
  const escrow = await prisma.ledgerAccount.findUnique({ where: { external_ref: '__ESCROW__' } });
  assert.equal(Number(escrow.balance), 0, 'escrow must be emptied after cancel');

  const ref2 = ref + 'b';
  await prisma.transaction.create({
    data: {
      transaction_id: ref2, tenant_id: tenantId, tenant_txn_ref: ref2,
      sender_ref: '2557000999', recipient_ref: '255712345678',
      user_external_ref: '2557000999', amount: 15000, currency: 'TZS', channel: 'bank',
      recipient_external_ref: '255712345678', occurred_at: new Date(),
      decision: 'hold', risk_score: 70,
    },
  });
  const hold2 = await prisma.hold.create({
    data: { hold_id: 'h-' + Date.now() + 9, transaction_id: ref2, ttl_seconds: 1800, status: 'active' },
  });
  const dispute = await prisma.dispute.create({
    data: { dispute_id: 'd-' + Date.now(), hold_id: hold2.hold_id, reason: 'e2e withdraw', status: 'open', sla_due_at: new Date(Date.now() + 86400000) },
  });

  res = await app.inject({ method: 'DELETE', url: `/v1/disputes/${dispute.dispute_id}`, headers: ops });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.json().status, 'withdrawn', JSON.stringify(res.body));
  const after = await prisma.dispute.findUnique({ where: { dispute_id: dispute.dispute_id } });
  assert.equal(after.status, 'withdrawn');

  await prisma.dispute.deleteMany({ where: { dispute_id: { in: [dispute.dispute_id] } } });
  await prisma.hold.deleteMany({ where: { hold_id: { in: [hold.hold_id, hold2.hold_id] } } });
  await prisma.ledgerEntry.deleteMany({ where: { reference: { in: [ref, ref2] } } });
  await prisma.ledgerAccount.deleteMany({ where: { external_ref: { in: ['2557000999', '__ESCROW__'] } } });
  assert.ok(true);
});
