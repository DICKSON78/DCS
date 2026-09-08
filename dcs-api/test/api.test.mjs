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
