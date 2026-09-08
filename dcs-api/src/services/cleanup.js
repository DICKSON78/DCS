import { prisma } from '../lib/prisma.js';

export async function cleanupExpired() {
  const now = new Date();
  const nonce = await prisma.requestNonce.deleteMany({
    where: { expires_at: { lt: now } },
  });
  const idempotency = await prisma.idempotencyRecord.deleteMany({
    where: { expires_at: { lt: now } },
  });
  return { noncesRemoved: nonce.count, idempotencyRemoved: idempotency.count };
}