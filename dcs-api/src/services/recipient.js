import { prisma } from '../lib/prisma.js';
import { maskName, hashIdentifier } from '../utils/crypto.js';

const CORE_SYSTEM_NAME_LOOKUP = Symbol('coreSystemNameLookup');

async function lookupRegisteredName(tenantType, recipientRef, channel) {
  if (!global[CORE_SYSTEM_NAME_LOOKUP]) return null;
  return global[CORE_SYSTEM_NAME_LOOKUP](tenantType, recipientRef, channel);
}

export async function verifyRecipient({ tenantId, tenantType, recipientExternalRef, channel, tenantTxnRef }) {
  const registered = await lookupRegisteredName(tenantType, recipientExternalRef, channel);

  const verified = Boolean(registered?.verified ?? Boolean(registered?.registered_name));
  const fullName = registered?.registered_name ?? null;
  const displayName = fullName ? maskName(fullName) : null;
  const accountAgeDays = registered?.account_age_days ?? null;
  const firstTimeRecipient = registered?.first_time_recipient ?? null;

  const record = await prisma.recipientVerification.create({
    data: {
      tenant_id: tenantId,
      recipient_external_ref: hashIdentifier(recipientExternalRef),
      channel,
      tenant_txn_ref: tenantTxnRef,
      verified,
      recipient_display_name: displayName,
      account_age_days: accountAgeDays,
      first_time_recipient: firstTimeRecipient,
    },
  });

  return {
    verification_id: record.verification_id,
    verified,
    recipient_display_name: displayName,
    account_age_days: accountAgeDays,
    first_time_recipient: firstTimeRecipient,
  };
}

export function registerNameLookup(fn) {
  global[CORE_SYSTEM_NAME_LOOKUP] = fn;
}