import { MODEL_VERSION } from './transaction.js';

export function buildFailPolicyDecision(policy) {
  if (policy === 'fail_closed') {
    return {
      transaction_id: null,
      decision: 'block',
      risk_score: 100,
      reason_codes: ['SERVICE_UNAVAILABLE'],
      fail_policy_applied: 'fail_closed',
      degraded: true,
      model_version: MODEL_VERSION,
    };
  }
  return {
    transaction_id: null,
    decision: 'allow',
    risk_score: 0,
    reason_codes: ['SERVICE_UNAVAILABLE'],
    fail_policy_applied: 'fail_open',
    degraded: true,
    model_version: MODEL_VERSION,
  };
}

export function shouldApplyFailPolicy(err) {
  if (!err) return false;
  if (err.httpStatus && err.httpStatus >= 400 && err.httpStatus < 500) return false;
  if (err.statusCode && err.statusCode < 500) return false;
  return true;
}