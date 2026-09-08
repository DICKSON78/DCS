import { asyncHandler } from '../utils/async-handler.js';
import { requireOpsUser } from '../middleware/auth.js';
import { rotateApiKey, rotateSigningKey } from '../services/credentials.js';

export function registerOpsRoutes(fastify) {
  fastify.post(
    '/v1/ops/tenants/:tenantId/rotate-api-key',
    {
      preHandler: async (request, reply) => {
        await requireOpsUser(request);
      },
      schema: {
        summary: 'Rotate a tenant API key (returns the new key exactly once)',
        tags: ['ops'],
      },
    },
    asyncHandler(async (request, reply) => {
      const result = await rotateApiKey({
        tenantId: request.params.tenantId,
        actor: request.actor || 'ops',
      });
      reply.code(200).send(result);
    })
  );

  fastify.post(
    '/v1/ops/tenants/:tenantId/rotate-signing-key',
    {
      preHandler: async (request, reply) => {
        await requireOpsUser(request);
      },
      schema: {
        summary: 'Rotate a tenant request-signing secret (returns the new secret exactly once)',
        tags: ['ops'],
      },
    },
    asyncHandler(async (request, reply) => {
      const result = await rotateSigningKey({
        tenantId: request.params.tenantId,
        actor: request.actor || 'ops',
      });
      reply.code(200).send(result);
    })
  );
}