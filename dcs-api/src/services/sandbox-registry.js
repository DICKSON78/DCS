import { registerNameLookup } from './recipient.js';

const SANDBOX_DIRECTORY = new Map([
  ['255712345678', { registered_name: 'Juma Mohamed', account_age_days: 1850, first_time_recipient: false }],
  ['255712345679', { registered_name: 'Amina Hassan', account_age_days: 12, first_time_recipient: true }],
  ['255712345680', { registered_name: 'Baraka Mwinyi', account_age_days: 3000, first_time_recipient: false }],
  ['255713456789', { registered_name: 'Neema Joseph', account_age_days: 540, first_time_recipient: false }],
  ['255714567890', { registered_name: 'Daudi Kileo', account_age_days: 2, first_time_recipient: true }],
]);

export function sandboxNameLookup(tenantType, recipientRef, channel) {
  const normalized = String(recipientRef).replace(/\D/g, '');
  const entry = SANDBOX_DIRECTORY.get(normalized);
  if (!entry) return null;

  return {
    registered_name: entry.registered_name,
    account_age_days: entry.account_age_days,
    first_time_recipient: entry.first_time_recipient,
    verified: true,
    source: 'sandbox-registry',
  };
}

export function installSandboxLookup() {
  registerNameLookup(sandboxNameLookup);
}