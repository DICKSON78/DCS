import { asyncHandler } from '../utils/async-handler.js';
import { getMetrics } from '../utils/metrics.js';
import { verifyAuditChain } from '../services/audit.js';

export function registerHealthRoutes(fastify) {
  fastify.get(
    '/v1/health',
    asyncHandler(async (request, reply) => {
      const metrics = getMetrics();
      const validate = metrics.validate;
      const withinSla =
        validate && validate.samples > 0 && validate.p95_ms != null && validate.p95_ms <= 150;

      const { valid, entries } = await verifyAuditChain('tenant-test-0001');

      reply.code(200).send({
        status: 'operational',
        service: 'dcs',
        version: '0.1.0',
        sla: {
          validate_p95_ms: validate?.p95_ms ?? null,
          validate_p99_ms: validate?.p99_ms ?? null,
          validate_samples: validate?.samples ?? 0,
          status: withinSla ? 'within_sla' : validate?.samples ? 'outside_sla' : 'no_samples',
        },
        audit_chain: { status: valid ? 'tamper_evident' : 'broken', checked_entries: entries },
        timestamp: new Date().toISOString(),
      });
    })
  );
}