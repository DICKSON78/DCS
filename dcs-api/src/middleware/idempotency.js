import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/errors.js';

export async function idempotencyGuard(request, reply, handler) {
  const requestId = request.headers['x-request-id'];
  const tenantId = request.tenantId;

  if (!requestId) {
    return handler.call(this);
  }

  const endpoint = request.routeOptions?.url || request.routerPath || 'unknown';
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  let claim;
  try {
    claim = await prisma.idempotencyRecord.create({
      data: { request_id: requestId, tenant_id: tenantId, endpoint, status: 'processing', expires_at: expiresAt },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      const existing = await prisma.idempotencyRecord.findUnique({
        where: { request_id_tenant_id: { request_id: requestId, tenant_id: tenantId } },
      });
      if (existing?.status === 'processing') {
        throw new ApiError(409, 'duplicate_request', 'This request is already being processed');
      }
      reply
        .code(409)
        .header('X-DCS-Duplicate', 'true')
        .send(existing?.response ?? { error: 'duplicate_request', message: 'This request has already been processed' });
      return;
    }
    if (/connection|ECONNREFUSED|ETIMEDOUT|database/.test(String(err?.message))) {
      request.log.warn({ err }, 'idempotency unavailable; processing without dedup');
      return handler.call(this);
    }
    throw err;
  }

  try {
    const response = await handler.call(this);

    const sanitizedResponse = JSON.parse(
      JSON.stringify(response, (key, value) => (value === undefined ? null : value))
    );

    await prisma.idempotencyRecord
      .update({
        where: { id: claim.id },
        data: { response: sanitizedResponse, status: 'completed' },
      })
      .catch((err) =>
        request.log.warn({ err }, 'idempotency completion failed; best-effort')
      );

    return response;
  } catch (err) {
    await prisma.idempotencyRecord.delete({ where: { id: claim.id } }).catch(() => {});
    throw err;
  }
}