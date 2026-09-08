import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { hmacSHA256, sha256, constantTimeEqual } from '../utils/crypto.js';
import { ApiError } from '../utils/errors.js';

const SIGNATURE_WINDOW_MS = 5 * 60 * 1000;

export function buildSignatureInput({ timestamp, method, path, query, body }) {
  return [timestamp, method, path, query || '', body || ''].join('.');
}

export function signRequest({ signingSecret, timestamp, method, path, query, body }) {
  const input = buildSignatureInput({ timestamp, method, path, query, body });
  return hmacSHA256(signingSecret, input);
}

export async function verifyRequestSignature(request) {
  if (request.url === '/v1/health') return;
  if (request.url.startsWith('/v1/holds/') && request.url.endsWith('/freeze')) return;
  if (request.method === 'PATCH' && request.url.startsWith('/v1/disputes/')) return;

  const timestamp = request.headers['x-timestamp'];
  const nonce = request.headers['x-nonce'];
  const signature = request.headers['x-signature'];
  const signingSecret = request.tenant?.signing_key_hash;

  if (!timestamp || !nonce || !signature) {
    throw new ApiError(401, 'invalid_signature', 'X-Timestamp, X-Nonce and X-Signature headers are required');
  }

  if (!/^\d{10,13}$/.test(timestamp)) {
    throw new ApiError(401, 'invalid_timestamp', 'X-Timestamp must be epoch milliseconds');
  }

  const ts = Number(timestamp);
  const now = Date.now();
  if (Math.abs(now - ts) > SIGNATURE_WINDOW_MS) {
    throw new ApiError(401, 'stale_timestamp', 'Request timestamp is outside the allowed window');
  }

  const [method, pathname] = [request.method, request.url.split('?')[0]];
  const query = request.url.split('?')[1] || '';
  const body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {});

  const expected = signRequest({ signingSecret, timestamp, method, path: pathname, query, body });

  if (!constantTimeEqual(expected, signature)) {
    throw new ApiError(401, 'invalid_signature', 'Signature verification failed');
  }

  try {
    const seen = await prisma.$queryRaw`
      SELECT 1 FROM "RequestNonce"
      WHERE nonce = ${nonce} AND tenant_id = ${request.tenantId}
      LIMIT 1
    `;
    if (seen.length > 0) {
      throw new ApiError(409, 'replay_detected', 'This request nonce has already been used');
    }

    await prisma.requestNonce.create({
      data: {
        nonce,
        tenant_id: request.tenantId,
        expires_at: new Date(ts + SIGNATURE_WINDOW_MS),
      },
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.code === 'P2002') {
      throw new ApiError(409, 'replay_detected', 'This request nonce has already been used');
    }
    request.log.warn({ err }, 'nonce persistence failed; continuing best-effort');
  }
}

export function generateSigningSecret() {
  return crypto.randomBytes(32).toString('hex');
}
