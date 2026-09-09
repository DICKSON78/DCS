import { prisma } from '../lib/prisma.js';
import { now } from '../utils/crypto.js';

export const MODEL_VERSION = 'dcs-rules-v1.0';

const CHANNEL_WEIGHTS = {
  mobile_money: 1.0,
  bank: 0.8,
  internet: 1.1,
  ussd: 1.2,
  pos: 0.9,
  qr: 1.0,
};

const DEFAULT_TYPICAL_AMOUNT = 100000;
const CUSTOMER_CONSERVATIVE_AMOUNT = 50000;

export function computeRiskFeatures(payload) {
  const { amount, currency, channel, occurred_at, device_fingerprint } = payload;

  const amountNum = Number(amount);
  const occurred = new Date(occurred_at);
  const hour = occurred.getHours();

  return {
    amount: amountNum,
    currency,
    channel,
    hour,
    occurredAt: occurred,
    has_device: Boolean(device_fingerprint),
    device: device_fingerprint,
  };
}

export async function loadOrCreateBaseline(tenantId, userExternalRef) {
  let baseline = await prisma.customerBaseline.findUnique({
    where: { tenant_id_user_external_ref: { tenant_id: tenantId, user_external_ref: userExternalRef } },
  });

  if (!baseline) {
    baseline = await prisma.customerBaseline.create({
      data: {
        tenant_id: tenantId,
        user_external_ref: userExternalRef,
        typical_amount: DEFAULT_TYPICAL_AMOUNT,
        typical_recipients: [],
        typical_time_of_day: 'day',
        known_devices: [],
      },
    });
  }
  return baseline;
}

export function computeDeviceOK(baseline, device) {
  if (!device) return null;
  const knownDevices = Array.isArray(baseline.known_devices) ? baseline.known_devices : [];
  if (knownDevices.length === 0) return null;
  return knownDevices.includes(device);
}

export function computeVelocity(baseline, occurredAt) {
  const hourWindow = baseline.hour_window_start ? new Date(baseline.hour_window_start) : null;
  let count = baseline.tx_count_last_hour || 0;

  if (hourWindow && occurredAt - hourWindow > 60 * 60 * 1000) {
    count = 0;
  }
  count += 1;
  return count;
}

export function computeRecipientDiversity(baseline, occurredAt) {
  const dayWindow = baseline.day_window_start ? new Date(baseline.day_window_start) : null;
  let distinct = baseline.distinct_recipients_day || 0;

  if (dayWindow && occurredAt - dayWindow > 24 * 60 * 60 * 1000) {
    distinct = 0;
  }
  return distinct + 1;
}

export function computeAccountAgeDays(baseline, occurredAt) {
  const firstSeen = baseline.first_seen_at ? new Date(baseline.first_seen_at) : occurredAt;
  const days = Math.floor((occurredAt - firstSeen) / (24 * 60 * 60 * 1000));
  return days < 0 ? 0 : days;
}

export async function updateBaseline(baseline, features, recipientRef) {
  const typicalAmount = baseline.typical_amount
    ? Number(baseline.typical_amount) * 0.9 + features.amount * 0.1
    : features.amount;

  const recipients = Array.isArray(baseline.typical_recipients)
    ? baseline.typical_recipients
    : [];
  if (!recipients.includes(recipientRef)) {
    recipients.push(recipientRef);
  }

  const knownDevices = Array.isArray(baseline.known_devices) ? baseline.known_devices : [];
  if (features.device && !knownDevices.includes(features.device)) {
    knownDevices.push(features.device);
  }

  const hourWindow = baseline.hour_window_start ? new Date(baseline.hour_window_start) : null;
  let txCount = baseline.tx_count_last_hour || 0;
  if (!hourWindow || features.occurredAt - hourWindow > 60 * 60 * 1000) {
    txCount = 0;
    baseline.hour_window_start = features.occurredAt.toISOString();
  }
  txCount += 1;

  const dayWindow = baseline.day_window_start ? new Date(baseline.day_window_start) : null;
  let distinctRecipients = baseline.distinct_recipients_day || 0;
  if (!dayWindow || features.occurredAt - dayWindow > 24 * 60 * 60 * 1000) {
    distinctRecipients = 0;
    baseline.day_window_start = features.occurredAt.toISOString();
  }
  if (!recipients.includes(recipientRef)) {
    distinctRecipients += 1;
  }

  return prisma.customerBaseline.update({
    where: { baseline_id: baseline.baseline_id },
    data: {
      typical_amount: typicalAmount,
      typical_recipients: recipients.slice(-10),
      typical_time_of_day: features.hour >= 6 && features.hour < 22 ? 'day' : 'night',
      known_devices: knownDevices.slice(-5),
      tx_count_last_hour: txCount,
      hour_window_start: baseline.hour_window_start,
      distinct_recipients_day: distinctRecipients,
      day_window_start: baseline.day_window_start,
      updated_at: now(),
    },
  });
}

export function evaluateRules({
  amount, baselineAmount, hour, channel, recipients, recipientRef, isFirstTime, accountAgeDays,
  deviceOK, txCountLastHour, distinctRecipientsDay, customerAgeDays,
}) {
  const reasonCodes = [];
  let riskScore = 0;

  const atypicalAmount = amount > baselineAmount * 2.0 && amount <= baselineAmount * 3.0;
  const farAboveBaseline = amount > baselineAmount * 3.0;
  const nightChannel = (hour < 6 || hour >= 22) && channel === 'mobile_money';
  const newRecipient = isFirstTime === true;
  const veryYoungAccount = accountAgeDays != null && accountAgeDays < 7;
  const youngAccount = accountAgeDays != null && accountAgeDays >= 7 && accountAgeDays < 30;
  const newCustomerConservative = !baselineAmount || baselineAmount === DEFAULT_TYPICAL_AMOUNT;

  if (farAboveBaseline) {
    riskScore += 40;
    reasonCodes.push('AMOUNT_ABOVE_BASELINE');
  } else if (atypicalAmount) {
    riskScore += 30;
    reasonCodes.push('AMOUNT_ABOVE_BASELINE');
  }

  if (nightChannel) {
    riskScore += 15;
    reasonCodes.push('UNUSUAL_TIME_OF_DAY');
  }

  if (newRecipient) {
    riskScore += 10;
    reasonCodes.push('NEW_RECIPIENT');
  }

  if (veryYoungAccount) {
    riskScore += 20;
    reasonCodes.push('VERY_YOUNG_RECIPIENT_ACCOUNT');
  } else if (youngAccount) {
    riskScore += 10;
    reasonCodes.push('YOUNG_RECIPIENT_ACCOUNT');
  }

  if (newCustomerConservative) {
    riskScore += 10;
    reasonCodes.push('NEW_CUSTOMER');
  }

  if (deviceOK === false) {
    riskScore += 35;
    reasonCodes.push('DEVICE_CHANGE');
  }

  if (txCountLastHour != null && txCountLastHour > 5) {
    riskScore += 25;
    reasonCodes.push('HIGH_TXN_VELOCITY');
  }

  if (distinctRecipientsDay != null && distinctRecipientsDay > 5) {
    riskScore += 15;
    reasonCodes.push('MULTI_RECIPIENT_FUNNELING');
  }

  if (customerAgeDays != null && customerAgeDays < 1) {
    riskScore += 15;
    reasonCodes.push('COLD_START_CUSTOMER');
  }

  riskScore = Math.min(100, riskScore);

  let decision;
  if (riskScore >= 80) {
    decision = 'block';
  } else if (riskScore >= 60) {
    decision = 'hold';
  } else if (riskScore >= 25) {
    decision = 'warn';
  } else {
    decision = 'allow';
  }

  return { decision, riskScore, reasonCodes };
}

export function buildAdvisory(currentAmount, baselineAmount) {
  return {
    message:
      `This amount (${currentAmount}) is higher than your usual transaction amount (${baselineAmount}). ` +
      'Please confirm this is the correct amount and recipient before proceeding.',
    baseline_amount: baselineAmount,
    current_amount: currentAmount,
  };
}

export async function scoreTransaction({ tenantId, tenantTxnRef, userExternalRef, senderRef, recipientRef, amount, currency, channel, recipientExternalRef, deviceFingerprint, occurredAt }) {
  const features = computeRiskFeatures({ amount, currency, channel, occurred_at: occurredAt, device_fingerprint: deviceFingerprint });

  const baseline = await loadOrCreateBaseline(tenantId, userExternalRef);
  const baselineAmount = Number(baseline.typical_amount) || CUSTOMER_CONSERVATIVE_AMOUNT;

  const recentRecipientVerification = await prisma.recipientVerification.findFirst({
    where: {
      tenant_id: tenantId,
      recipient_external_ref: recipientExternalRef,
    },
    orderBy: { created_at: 'desc' },
  });

  const isFirstTime = recentRecipientVerification?.first_time_recipient ?? true;
  const accountAgeDays = recentRecipientVerification?.account_age_days ?? null;

  const deviceOK = computeDeviceOK(baseline, features.device);
  const txCountLastHour = computeVelocity(baseline, features.occurredAt);
  const distinctRecipientsDay = computeRecipientDiversity(baseline, features.occurredAt);
  const customerAgeDays = computeAccountAgeDays(baseline, features.occurredAt);

  const { decision, riskScore, reasonCodes } = evaluateRules({
    amount: features.amount,
    baselineAmount,
    hour: features.hour,
    channel: features.channel,
    recipientRef: recipientExternalRef,
    isFirstTime,
    accountAgeDays,
    deviceOK,
    txCountLastHour,
    distinctRecipientsDay,
    customerAgeDays,
  });

  const raw = riskScore + (CHANNEL_WEIGHTS[channel] || 1.0) * 0.1;
  const finalScore = Math.min(100, Math.round(raw * 10) / 10);

  const txn = await prisma.transaction.create({
    data: {
      tenant_id: tenantId,
      tenant_txn_ref: tenantTxnRef,
      user_external_ref: userExternalRef,
      sender_ref: senderRef,
      recipient_ref: recipientRef,
      amount: amount,
      currency,
      channel,
      recipient_external_ref: recipientExternalRef,
      device_fingerprint: deviceFingerprint,
      occurred_at: occurredAt,
      decision,
      risk_score: finalScore,
      model_version: MODEL_VERSION,
      reasonCodes: {
        create: reasonCodes.map((code) => ({ code })),
      },
    },
  });

  let holdObj;
  if (decision === 'hold') {
    const ttlSeconds = 30 * 60;
    const hold = await prisma.hold.create({
      data: {
        transaction_id: txn.transaction_id,
        ttl_seconds: ttlSeconds,
        status: 'active',
      },
    });
    holdObj = { hold_id: hold.hold_id, status: hold.status, ttl_seconds: ttlSeconds };
  }

  await updateBaseline(baseline, features, recipientExternalRef);

  const advisory =
    decision === 'warn' ? buildAdvisory(features.amount, baselineAmount) : undefined;

  return {
    transaction_id: txn.transaction_id,
    decision,
    risk_score: finalScore,
    reason_codes: reasonCodes,
    advisory,
    model_version: MODEL_VERSION,
    ttl_seconds: decision === 'hold' ? 30 * 60 : undefined,
    hold: holdObj,
  };
}
