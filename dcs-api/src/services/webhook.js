import { prisma } from '../lib/prisma.js';
import { hmacSHA256, sha256 } from '../utils/crypto.js';
import { config } from '../config/index.js';

export async function subscribeWebhook({ tenantId, callbackUrl }) {
  const secret = sha256(tenantId + ':' + callbackUrl);
  const subscription = await prisma.webhookSubscription.upsert({
    where: {
      webhook_id: tenantId,
    },
    create: {
      webhook_id: tenantId,
      tenant_id: tenantId,
      callback_url: callbackUrl,
      secret_hash: secret,
    },
    update: {
      callback_url: callbackUrl,
      secret_hash: secret,
    },
  });

  return {
    webhook_id: subscription.webhook_id,
    callback_url: subscription.callback_url,
    status: 'active',
  };
}

export async function createWebhookEvent({ tenantId, eventType, payload }) {
  const subscription = await prisma.webhookSubscription.findUnique({
    where: { tenant_id: tenantId },
  });

  if (!subscription) return null;

  return prisma.webhookEvent.create({
    data: {
      webhook_id: subscription.webhook_id,
      event_type: eventType,
      payload,
    },
  });
}

export async function deliverWebhookEvent(eventId) {
  const event = await prisma.webhookEvent.findUnique({
    where: { event_id: eventId },
    include: { webhook: true },
  });

  if (!event || event.delivered) return { delivered: false };

  const payload = JSON.stringify(event.payload);
  const signature = hmacSHA256(event.webhook.secret_hash, payload);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(event.webhook.callback_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DCS-Signature': signature,
      },
      body: payload,
      signal: controller.signal,
    });

    const acknowledged = res.ok;
    await prisma.webhookEvent.update({
      where: { event_id: eventId },
      data: {
        delivered: acknowledged,
        attempts: { increment: 1 },
      },
    });

    return { delivered: acknowledged, status: res.status };
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { event_id: eventId },
      data: { attempts: { increment: 1 } },
    });
    return { delivered: false, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function retryFailedWebhooks() {
  const cutoff = new Date(Date.now() - config.webhook.retryMaxHours * 60 * 60 * 1000);
  const failed = await prisma.webhookEvent.findMany({
    where: {
      delivered: false,
      created_at: { gte: cutoff },
    },
    take: 50,
  });

  for (const event of failed) {
    await deliverWebhookEvent(event.event_id);
  }

  return failed.length;
}
