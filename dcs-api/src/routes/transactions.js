import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/errors.js';
import { scoreTransaction } from '../services/transaction.js';
import { buildFailPolicyDecision, shouldApplyFailPolicy } from '../services/fail-policy.js';
import { settleTransfer } from '../services/ledger.js';
import { prisma } from '../lib/prisma.js';
import { hashIdentifier } from '../utils/crypto.js';
import { idempotencyGuard } from '../middleware/idempotency.js';

const ValidateTransactionSchema = z.object({
  tenant_txn_ref: z.string().min(1).max(100),
  user_external_ref: z.string().min(1).max(255),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3),
  channel: z.enum(['mobile_money', 'bank', 'internet', 'ussd', 'pos', 'qr']),
  recipient_external_ref: z.string().min(1).max(255),
  device_fingerprint: z.string().optional(),
  occurred_at: z.coerce.date(),
});

export function registerTransactionRoutes(fastify) {
  fastify.post(
    '/v1/transactions/validate',
    {
      schema: {
        summary: 'Validate a transaction risk before settlement',
        tags: ['transactions'],
      },
    },
    asyncHandler(async (request, reply) => {
      return idempotencyGuard.call(this, request, reply, async () => {
        const parsed = ValidateTransactionSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new ApiError(400, 'invalid_payload', 'Invalid payload', parsed.error.flatten());
        }

        try {
          return await scoreTransaction({
            tenantId: request.tenantId,
            tenantTxnRef: parsed.data.tenant_txn_ref,
            userExternalRef: hashIdentifier(parsed.data.user_external_ref),
            amount: parsed.data.amount,
            currency: parsed.data.currency,
            channel: parsed.data.channel,
            recipientExternalRef: hashIdentifier(parsed.data.recipient_external_ref),
            senderRef: parsed.data.user_external_ref,
            recipientRef: parsed.data.recipient_external_ref,
            deviceFingerprint: parsed.data.device_fingerprint,
            occurredAt: parsed.data.occurred_at,
          });
        } catch (err) {
          if (shouldApplyFailPolicy(err)) {
            request.log.error({ err }, 'transaction scoring degraded');
            return buildFailPolicyDecision(request.tenant.fail_policy);
          }
          throw err;
        }
      });
    })
  );

  fastify.get(
    '/v1/transactions/:id',
    asyncHandler(async (request, reply) => {
      const { id } = request.params;

      const txn = await prisma.transaction.findUnique({
        where: { transaction_id: id },
        include: { reasonCodes: true },
      });

      if (!txn || txn.tenant_id !== request.tenantId) {
        throw new ApiError(404, 'not_found', 'Transaction not found');
      }

      reply.code(200).send({
        transaction_id: txn.transaction_id,
        decision: txn.decision,
        risk_score: txn.risk_score,
        reason_codes: txn.reasonCodes.map((r) => r.code),
        model_version: txn.model_version,
        created_at: txn.created_at,
      });
    })
  );

  fastify.post(
    '/v1/transactions/:id/settle',
    {
      schema: {
        summary: 'Atomically apply a validated decision to the ledger (debit sender / credit recipient)',
        tags: ['transactions'],
      },
    },
    asyncHandler(async (request, reply) => {
      const { id } = request.params;

      const txn = await prisma.transaction.findUnique({
        where: { transaction_id: id },
        include: { hold: true },
      });

      if (!txn || txn.tenant_id !== request.tenantId) {
        throw new ApiError(404, 'not_found', 'Transaction not found');
      }

      const existing = await prisma.ledgerEntry.findFirst({ where: { reference: id } });
      if (existing) {
        throw new ApiError(409, 'conflict', 'Transaction already settled');
      }

      let fromRef;
      let toRef;
      let kind;
      let action;
      if (txn.decision === 'allow' || txn.decision === 'warn') {
        action = 'transfer';
        fromRef = txn.sender_ref;
        toRef = txn.recipient_ref;
        kind = 'transfer';
      } else if (txn.decision === 'hold') {
        action = 'hold_reserve';
        fromRef = txn.sender_ref;
        toRef = '__ESCROW__';
        kind = 'hold_reserve';
      } else {
        throw new ApiError(409, 'conflict', 'Decision ' + txn.decision + ' does not move money');
      }

      if (!fromRef || !toRef) {
        throw new ApiError(422, 'unprocessable', 'Raw wallet refs missing on transaction');
      }

      const settled = await settleTransfer({
        reference: txn.transaction_id,
        fromRef,
        toRef,
        amount: Number(txn.amount),
        kind,
      });

      reply.code(200).send({
        transaction_id: txn.transaction_id,
        settled: true,
        action,
        amount: Number(txn.amount),
        decision: txn.decision,
        from: {
          external_ref: fromRef,
          balance: Number(settled.from.balance),
          reserved: txn.decision === 'hold',
        },
        to: {
          external_ref: toRef,
          balance: Number(settled.to.balance),
        },
      });
    })
  );
}
