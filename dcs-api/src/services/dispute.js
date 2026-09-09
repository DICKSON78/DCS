import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/errors.js';
import { now } from '../utils/crypto.js';
import { createWebhookEvent, deliverWebhookEvent } from './webhook.js';
import { createAuditLog } from './audit.js';
import { refundHeldFunds, hasReserveFor } from './ledger.js';

const DISPUTE_SLA_HOURS = 48;

async function resolveOpsUser(actor) {
  let user = await prisma.opsUser.findUnique({ where: { analyst_id: actor } });
  if (!user && actor === 'ops') {
    user = await prisma.opsUser.upsert({
      where: { analyst_id: 'ops' },
      create: {
        analyst_id: 'ops',
        name: 'DCS Operations',
        role: 'admin',
        email: 'ops@dcs.co.tz',
      },
      update: {},
    });
  }
  return user?.analyst_id || actor;
}

export async function fileDispute({ holdId, tenantId, reason, evidenceUrl }) {
  const hold = await prisma.hold.findUnique({
    where: { hold_id: holdId },
    include: { transaction: true },
  });

  if (!hold || hold.transaction.tenant_id !== tenantId) {
    throw new ApiError(404, 'not_found', 'Hold not found');
  }

  if (hold.status !== 'active' && hold.status !== 'frozen') {
    throw new ApiError(409, 'conflict', 'Only active or frozen holds can be disputed');
  }

  const dispute = await prisma.dispute.create({
    data: {
      hold_id: holdId,
      reason,
      evidence_url: evidenceUrl,
      status: 'open',
      sla_due_at: new Date(Date.now() + DISPUTE_SLA_HOURS * 60 * 60 * 1000),
    },
  });

  await createAuditLog({
    tenantId,
    entityType: 'DISPUTE',
    entityId: dispute.dispute_id,
    action: 'file',
    actor: 'tenant',
  });

  return {
    dispute_id: dispute.dispute_id,
    status: 'open',
    sla_due_at: dispute.sla_due_at,
  };
}

export async function resolveDispute({ disputeId, outcome, note, analystId }) {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
    include: { hold: { include: { transaction: true } } },
  });

  if (!dispute) {
    throw new ApiError(404, 'not_found', 'Dispute not found');
  }

  if (dispute.status !== 'open') {
    throw new ApiError(409, 'conflict', 'Dispute already resolved');
  }

  if (outcome !== 'approved' && outcome !== 'rejected') {
    throw new ApiError(400, 'invalid_payload', 'outcome must be approved or rejected');
  }

  const resolvedAnalystId = await resolveOpsUser(analystId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.dispute.update({
      where: { dispute_id: disputeId },
      data: { status: 'resolved', outcome, analyst_id: resolvedAnalystId, resolved_at: now() },
    });

    if (outcome === 'approved') {
      const reserve = await hasReserveFor(dispute.hold.transaction.transaction_id);
      if (reserve) {
        await refundHeldFunds({
          reference: dispute.hold.transaction.transaction_id,
          toRef: dispute.hold.transaction.sender_ref,
          amount: Number(dispute.hold.transaction.amount),
          tx,
        });
      }
    }

    await createAuditLog({
      tenantId: dispute.hold.transaction.tenant_id,
      entityType: 'DISPUTE',
      entityId: disputeId,
      action: 'resolve',
      actor: analystId,
    });

    const event = await createWebhookEvent({
      tenantId: dispute.hold.transaction.tenant_id,
      eventType: 'dispute.resolved',
      payload: {
        event: 'dispute.resolved',
        dispute_id: disputeId,
        hold_id: dispute.hold_id,
        outcome,
        resolved_at: updated.resolved_at,
      },
    });

    if (event) {
      deliverWebhookEvent(event.event_id).catch(() => {});
    }

    return {
      dispute_id: updated.dispute_id,
      outcome: updated.outcome,
      resolved_at: updated.resolved_at,
    };
  });
}
