import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskName, sha256, hmacSHA256, hashIdentifier } from '../src/utils/crypto.js';
import { evaluateRules, computeRiskFeatures, MODEL_VERSION } from '../src/services/transaction.js';

test('maskName partially masks names', () => {
  assert.equal(maskName('John Mwakalinga'), 'J**N M***A');
  assert.equal(maskName('AB'), 'A*');
  assert.equal(maskName(null), null);
  assert.notEqual(maskName('John'), 'John');
});

test('sha256 is deterministic hex', () => {
  assert.equal(sha256('a').length, 64);
  assert.equal(sha256('a'), sha256('a'));
  assert.notEqual(sha256('a'), sha256('b'));
});

test('hmacSHA256 signs payload', () => {
  const sig = hmacSHA256('secret', 'payload');
  assert.equal(sig.length, 64);
  assert.equal(sig, hmacSHA256('secret', 'payload'));
  assert.notEqual(sig, hmacSHA256('secret', 'other'));
});

test('hashIdentifier prefixes hashed refs', () => {
  assert.match(hashIdentifier('255712345678'), /^h_[0-9a-f]{64}$/);
});

test('computeRiskFeatures extracts features', () => {
  const f = computeRiskFeatures({
    amount: 500000,
    currency: 'TZS',
    channel: 'mobile_money',
    occurred_at: '2026-09-08T02:00:00Z',
    device_fingerprint: 'dev1',
  });
  assert.equal(f.amount, 500000);
  assert.equal(f.currency, 'TZS');
  assert.equal(f.hour >= 0 && f.hour < 24, true);
  assert.equal(f.has_device, true);
});

test('evaluateRules returns allow for normal transaction', () => {
  const r = evaluateRules({
    amount: 50000,
    baselineAmount: 50000,
    hour: 12,
    channel: 'bank',
    recipientRef: 'h_a',
    isFirstTime: false,
    accountAgeDays: 3000,
  });
  assert.equal(r.decision, 'allow');
  assert.equal(r.riskScore < 25, true);
});

test('evaluateRules returns warn for atypical amount', () => {
  const r = evaluateRules({
    amount: 150000,
    baselineAmount: 50000,
    hour: 12,
    channel: 'bank',
    recipientRef: 'h_b',
    isFirstTime: false,
    accountAgeDays: 3000,
  });
  assert.equal(r.decision, 'warn');
  assert.ok(r.riskScore >= 25 && r.riskScore < 60);
  assert.ok(r.reasonCodes.includes('AMOUNT_ABOVE_BASELINE'));
});

test('evaluateRules returns hold for high-risk combination', () => {
  const r = evaluateRules({
    amount: 5000000,
    baselineAmount: 50000,
    hour: 2,
    channel: 'mobile_money',
    recipientRef: 'h_c',
    isFirstTime: true,
    accountAgeDays: 10,
  });
  assert.ok(r.riskScore >= 60 && r.riskScore < 80);
});

test('evaluateRules returns block for confirmed risk', () => {
  const r = evaluateRules({
    amount: 5000000,
    baselineAmount: 50000,
    hour: 2,
    channel: 'mobile_money',
    recipientRef: 'h_d',
    isFirstTime: true,
    accountAgeDays: 5,
  });
  assert.equal(r.decision, 'block');
  assert.ok(r.riskScore >= 80);
});

test('evaluateRules flags device change (account takeover / SIM swap)', () => {
  const r = evaluateRules({
    amount: 50000,
    baselineAmount: 50000,
    hour: 12,
    channel: 'bank',
    recipientRef: 'h_e',
    isFirstTime: false,
    accountAgeDays: 3000,
    deviceOK: false,
  });
  assert.ok(r.riskScore >= 25, `expected warn, got ${r.riskScore}`);
  assert.ok(r.reasonCodes.includes('DEVICE_CHANGE'));
});

test('evaluateRules flags high transaction velocity (rapid drain)', () => {
  const r = evaluateRules({
    amount: 50000,
    baselineAmount: 50000,
    hour: 12,
    channel: 'bank',
    recipientRef: 'h_f',
    isFirstTime: false,
    accountAgeDays: 3000,
    txCountLastHour: 8,
  });
  assert.ok(r.reasonCodes.includes('HIGH_TXN_VELOCITY'));
  assert.ok(r.riskScore >= 25, `expected warn, got ${r.riskScore}`);
});

test('evaluateRules flags multi-recipient funneling (mule pattern)', () => {
  const r = evaluateRules({
    amount: 50000,
    baselineAmount: 50000,
    hour: 12,
    channel: 'bank',
    recipientRef: 'h_g',
    isFirstTime: false,
    accountAgeDays: 3000,
    distinctRecipientsDay: 7,
  });
  assert.ok(r.reasonCodes.includes('MULTI_RECIPIENT_FUNNELING'));
});

test('evaluateRules flags cold-start customer (synthetic identity)', () => {
  const r = evaluateRules({
    amount: 50000,
    baselineAmount: 50000,
    hour: 12,
    channel: 'bank',
    recipientRef: 'h_h',
    isFirstTime: false,
    accountAgeDays: 3000,
    customerAgeDays: 0,
  });
  assert.ok(r.reasonCodes.includes('COLD_START_CUSTOMER'));
});

test('MODEL_VERSION is versioned for auditability', () => {
  assert.match(MODEL_VERSION, /^dcs-rules-v\d+\.\d+$/);
});

import { buildFailPolicyDecision, shouldApplyFailPolicy } from '../src/services/fail-policy.js';

test('fail_open decision allows during degraded service', () => {
  const r = buildFailPolicyDecision('fail_open');
  assert.equal(r.decision, 'allow');
  assert.equal(r.degraded, true);
  assert.ok(r.reason_codes.includes('SERVICE_UNAVAILABLE'));
});

test('fail_closed decision blocks during degraded service', () => {
  const r = buildFailPolicyDecision('fail_closed');
  assert.equal(r.decision, 'block');
  assert.equal(r.degraded, true);
  assert.ok(r.reason_codes.includes('SERVICE_UNAVAILABLE'));
});

test('client errors should NOT trigger the circuit breaker', () => {
  const e = new Error('bad');
  e.httpStatus = 400;
  assert.equal(shouldApplyFailPolicy(e), false);
});

test('internal errors SHOULD trigger the circuit breaker', () => {
  const e = new Error('database gone');
  assert.equal(shouldApplyFailPolicy(e), true);
});
