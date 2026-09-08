import { prisma } from '../lib/prisma.js';
import { ApiError, errorCodes } from '../utils/errors.js';
import { now } from '../utils/crypto.js';
import { createAuditLog } from './audit.js';

export async function releaseHold({ holdId, tenantId, releasedBy, note }) {
  const hold = await prisma.hold.findUnique({
    where: { hold_id: holdId },
    include: { transaction: true },
  });

  if (!hold || hold.transaction.tenant_id !== tenantId) {
    throw new ApiError(404, 'not_found', 'Hold not found');
  }

  if (hold.status === 'frozen') {
    throw new ApiError(409, 'conflict', 'Hold has been escalated to a freeze; release is blocked until investigation concludes');
  }

  if (hold.status === 'released') {
    throw new ApiError(409, 'conflict', 'Hold already released');
  }

  const updated = await prisma.hold.update({
    where: { hold_id: holdId },
    data: { status: 'released', released_by: releasedBy, released_at: now() },
  });

  await createAuditLog({
    tenantId,
    entityType: 'HOLD',
    entityId: holdId,
    action: 'release',
    actor: releasedBy || 'system',
  });

  return {
    hold_id: updated.hold_id,
    status: 'released',
    released_at: updated.released_at,
  };
}

export async function freezeHold({ holdId, actor }) {
  const hold = await prisma.hold.findUnique({
    where: { hold_id: holdId },
    include: { transaction: true },
  });

  if (!hold) {
    throw new ApiError(404, 'not_found', 'Hold not found');
  }

  if (hold.status !== 'active') {
    throw new ApiError(409, 'conflict', 'Only an active hold can be escalated to a freeze');
  }

  const updated = await prisma.hold.update({
    where: { hold_id: holdId },
    data: { status: 'frozen' },
  });

  await createAuditLog({
    tenantId: hold.transaction.tenant_id,
    entityType: 'HOLD',
    entityId: holdId,
    action: 'freeze',
    actor,
  });

  return {
    hold_id: updated.hold_id,
    status: 'frozen',
  };
}

export async function autoReleaseExpiredHolds() {
  const expired = await prisma.hold.findMany({
    where: {
      status: 'active',
      created_at: { lt: new Date(Date.now() - 30 * 60 * 1000) },
    },
    include: { transaction: true },
  });

  for (const hold of expired) {
    await prisma.hold.update({
      where: { hold_id: hold.hold_id },
      data: { status: 'released', released_at: now(), released_by: 'system' },
    });
    await createAuditLog({
      tenantId: hold.transaction.tenant_id,
      entityType: 'HOLD',
      entityId: hold.hold_id,
      action: 'auto_release',
      actor: 'system',
    });
  }

  return expired.length;
}
