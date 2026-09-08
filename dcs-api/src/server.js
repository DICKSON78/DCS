import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config/index.js';
import { registerTenantAuth, registerOpsAuth } from './middleware/routes-auth.js';
import { rateLimiter } from './middleware/rate-limit.js';
import { registerRecipientRoutes } from './routes/recipients.js';
import { registerTransactionRoutes } from './routes/transactions.js';
import { registerHoldRoutes } from './routes/holds.js';
import { registerDisputeRoutes } from './routes/disputes.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAuditRoutes } from './routes/audit.js';
import { disconnectPrisma } from './lib/prisma.js';
import { autoReleaseExpiredHolds } from './services/hold.js';
import { retryFailedWebhooks } from './services/webhook.js';
import { cleanupExpired } from './services/cleanup.js';
import { installSandboxLookup } from './services/sandbox-registry.js';
import { loadTenantRegistry } from './services/tenant-registry.js';
import { recordLatency, getMetrics } from './utils/metrics.js';

export async function buildServer() {
  const httpsOptions = config.tls.enabled
    ? {
        key: config.tls.key,
        cert: config.tls.cert,
        ca: config.tls.ca,
        requestCert: config.tls.requestClientCert,
        rejectUnauthorized: config.tls.rejectUnauthorized,
      }
    : undefined;

  const fastify = Fastify({
    logger: { level: config.logLevel },
    trustProxy: true,
    https: httpsOptions,
  });

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Digital Consumer Shield API',
        description: 'Real-time recipient verification, fraud detection and transaction hold/freeze/block for Tanzanian financial corridors.',
        version: '0.1.0',
      },
      servers: [{ url: 'http://localhost:8080' }],
    },
  });
  await fastify.register(swaggerUi, { routePrefix: '/docs' });
  await fastify.register(helmet, { global: true });
  await fastify.register(cors, { origin: false });

  installSandboxLookup();

  try {
    await loadTenantRegistry();
  } catch (err) {
    fastify.log.warn({ err }, 'tenant registry load failed at startup');
  }

  registerTenantAuth(fastify);
  registerOpsAuth(fastify);
  rateLimiter(fastify);

  fastify.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions?.url;
    if (route === '/v1/transactions/validate') {
      recordLatency('validate', reply.elapsedTime);
    }
  });

  fastify.setErrorHandler((err, request, reply) => {
    if (err && err.httpStatus) {
      request.log.warn({ err }, 'api error');
      reply.code(err.httpStatus).send({ error: err.code, message: err.message });
      return;
    }

    if (err.validation) {
      reply.code(400).send({ error: 'invalid_payload', message: 'Validation error' });
      return;
    }

    if (err.statusCode === 429) {
      reply.code(429).send({ error: 'rate_limited', message: 'Per-tenant request quota exceeded' });
      return;
    }

    request.log.error({ err }, 'unhandled error');
    reply.code(500).send({ error: 'internal_error', message: 'Internal server error' });
  });

  registerHealthRoutes(fastify);
  registerRecipientRoutes(fastify);
  registerTransactionRoutes(fastify);
  registerHoldRoutes(fastify);
  registerDisputeRoutes(fastify);
  registerWebhookRoutes(fastify);
  registerAuditRoutes(fastify);

  let autoReleaseTimer;
  let webhookRetryTimer;
  let cleanupTimer;
  let registryRefreshTimer;

  fastify.addHook('onListen', () => {
    autoReleaseTimer = setInterval(async () => {
      try {
        await autoReleaseExpiredHolds();
      } catch (err) {
        fastify.log.error({ err }, 'auto-release failed');
      }
    }, 60 * 1000);

    webhookRetryTimer = setInterval(async () => {
      try {
        await retryFailedWebhooks();
      } catch (err) {
        fastify.log.error({ err }, 'webhook retry failed');
      }
    }, 5 * 60 * 1000);

    cleanupTimer = setInterval(async () => {
      try {
        const result = await cleanupExpired();
        if (result.noncesRemoved > 0 || result.idempotencyRemoved > 0) {
          fastify.log.info({ result }, 'expired records cleaned');
        }
      } catch (err) {
        fastify.log.error({ err }, 'cleanup job failed');
      }
    }, 60 * 1000);

    registryRefreshTimer = setInterval(async () => {
      try {
        await loadTenantRegistry();
      } catch (err) {
        fastify.log.warn({ err }, 'tenant registry refresh failed');
      }
    }, 60 * 1000);
  });

  fastify.addHook('onClose', async () => {
    if (autoReleaseTimer) clearInterval(autoReleaseTimer);
    if (webhookRetryTimer) clearInterval(webhookRetryTimer);
    if (cleanupTimer) clearInterval(cleanupTimer);
    if (registryRefreshTimer) clearInterval(registryRefreshTimer);
    await disconnectPrisma();
  });

  return fastify;
}

if (process.env.NODE_ENV !== 'test') {
  const server = await buildServer();
  try {
    await server.listen({ port: config.port, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}
