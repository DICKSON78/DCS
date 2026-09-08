import { authenticateTenant, requireOpsUser } from './auth.js';
import { verifyRequestSignature } from './request-sign.js';

export function registerTenantAuth(fastify) {
  fastify.addHook('onRequest', async (request) => {
    if (request.url === '/v1/health') return;
    if (request.url.startsWith('/docs')) return;
    if (request.url.startsWith('/v1/audit/')) return;
    if (request.url.startsWith('/v1/holds/') && request.url.endsWith('/freeze')) return;
    if (request.method === 'PATCH' && request.url.startsWith('/v1/disputes/')) return;
    await authenticateTenant(request);
  });

  fastify.addHook('preHandler', async (request) => {
    if (request.url === '/v1/health') return;
    if (request.url.startsWith('/docs')) return;
    if (request.url.startsWith('/v1/audit/')) return;
    if (request.url.startsWith('/v1/holds/') && request.url.endsWith('/freeze')) return;
    if (request.method === 'PATCH' && request.url.startsWith('/v1/disputes/')) return;
    if (!request.routeOptions?.url) return;
    await verifyRequestSignature(request);
  });
}

export function registerOpsAuth(fastify) {
  fastify.addHook('onRequest', async (request) => {
    if (request.url === '/v1/health') return;
    const isOpsRoute =
      (request.url.startsWith('/v1/holds/') && request.url.endsWith('/freeze')) ||
      (request.method === 'PATCH' && request.url.startsWith('/v1/disputes/'));
    if (isOpsRoute) {
      await requireOpsUser(request);
    }
  });
}
