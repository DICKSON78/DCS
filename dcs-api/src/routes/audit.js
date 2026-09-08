import { asyncHandler } from '../utils/async-handler.js';
import { verifyAuditChain } from '../services/audit.js';
import { requireOpsUser } from '../middleware/auth.js';

export function registerAuditRoutes(fastify) {
  fastify.get(
    '/v1/audit/verify/:tenantId',
    {
      preHandler: async (request, reply) => {
        await requireOpsUser(request);
      },
      schema: {
        summary: 'Verify tamper-evidence of a tenant audit trail',
        tags: ['audit'],
      },
    },
    asyncHandler(async (request, reply) => {
      const { tenantId } = request.params;
      const result = await verifyAuditChain(tenantId);
      reply.code(result.valid ? 200 : 409).send(result);
    })
  );
}