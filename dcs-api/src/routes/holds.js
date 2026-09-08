import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/errors.js';
import { releaseHold, freezeHold } from '../services/hold.js';

const ReleaseSchema = z.object({
  released_by: z.string().optional().default('system'),
  note: z.string().optional(),
});

const FreezeSchema = z.object({});

export function registerHoldRoutes(fastify) {
  fastify.post(
    '/v1/holds/:id/release',
    asyncHandler(async (request, reply) => {
      const parsed = ReleaseSchema.safeParse(request.body || {});
      if (!parsed.success) {
        throw new ApiError(400, 'invalid_payload', 'Invalid payload');
      }
      const result = await releaseHold({
        holdId: request.params.id,
        tenantId: request.tenantId,
        releasedBy: parsed.data.released_by,
        note: parsed.data.note,
      });
      reply.code(200).send(result);
    })
  );

  fastify.post(
    '/v1/holds/:id/freeze',
    asyncHandler(async (request, reply) => {
      const result = await freezeHold({
        holdId: request.params.id,
        actor: 'ops',
      });
      reply.code(200).send(result);
    })
  );
}
