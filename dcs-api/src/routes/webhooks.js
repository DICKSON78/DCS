import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';
import { ApiError } from '../utils/errors.js';
import { subscribeWebhook } from '../services/webhook.js';

const SubscribeSchema = z.object({
  callback_url: z.string().url(),
});

export function registerWebhookRoutes(fastify) {
  fastify.post(
    '/v1/webhooks/subscribe',
    asyncHandler(async (request, reply) => {
      const parsed = SubscribeSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ApiError(400, 'invalid_payload', 'Invalid payload', parsed.error.flatten());
      }
      const result = await subscribeWebhook({
        tenantId: request.tenantId,
        callbackUrl: parsed.data.callback_url,
      });
      reply.code(200).send(result);
    })
  );
}
