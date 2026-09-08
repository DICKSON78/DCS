import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/errors.js';
import { verifyRecipient } from '../services/recipient.js';
import { hashIdentifier } from '../utils/crypto.js';

const VerifyRecipientSchema = z.object({
  recipient_external_ref: z.string().min(1).max(255),
  channel: z.string().min(1).max(50),
  tenant_txn_ref: z.string().min(1).max(100),
});

export function registerRecipientRoutes(fastify) {
  fastify.post(
    '/v1/recipients/verify',
    asyncHandler(async (request, reply) => {
      const parsed = VerifyRecipientSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ApiError(400, 'invalid_payload', 'Invalid payload', parsed.error.flatten());
      }

      const { recipient_external_ref, channel, tenant_txn_ref } = parsed.data;

      const result = await verifyRecipient({
        tenantId: request.tenantId,
        tenantType: request.tenant.tenant_type,
        recipientExternalRef: recipient_external_ref,
        channel,
        tenantTxnRef: tenant_txn_ref,
      });

      reply.code(200).send(result);
    })
  );
}
