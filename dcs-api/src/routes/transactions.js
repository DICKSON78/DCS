import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/errors.js';
import { scoreTransaction } from '../services/transaction.js';
import { buildFailPolicyDecision, shouldApplyFailPolicy } from '../services/fail-policy.js';
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
}
