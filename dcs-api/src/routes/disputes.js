import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/errors.js';
import { fileDispute, resolveDispute } from '../services/dispute.js';

const FileDisputeSchema = z.object({
  hold_id: z.string().min(1),
  reason: z.string().min(1).max(2000),
  evidence_url: z.string().url().optional(),
});

const ResolveDisputeSchema = z.object({
  outcome: z.enum(['approved', 'rejected']),
  note: z.string().optional(),
});

export function registerDisputeRoutes(fastify) {
  fastify.post(
    '/v1/disputes',
    asyncHandler(async (request, reply) => {
      const parsed = FileDisputeSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ApiError(400, 'invalid_payload', 'Invalid payload', parsed.error.flatten());
      }
      const result = await fileDispute({
        holdId: parsed.data.hold_id,
        tenantId: request.tenantId,
        reason: parsed.data.reason,
        evidenceUrl: parsed.data.evidence_url,
      });
      reply.code(201).send(result);
    })
  );

  fastify.patch(
    '/v1/disputes/:id',
    asyncHandler(async (request, reply) => {
      const parsed = ResolveDisputeSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ApiError(400, 'invalid_payload', 'Invalid payload', parsed.error.flatten());
      }
      const result = await resolveDispute({
        disputeId: request.params.id,
        outcome: parsed.data.outcome,
        note: parsed.data.note,
        analystId: 'ops',
      });
      reply.code(200).send(result);
    })
  );
}
