import { config } from '../config/index.js';

const buckets = new Map();

const RATE = config.rateLimit.perSecond;
const BURST_RATE = config.rateLimit.burstPerSecond;
const BURST_DURATION = config.rateLimit.burstDuration;

function getBucket(key) {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      tokens: RATE,
      last: Date.now(),
      burstStart: 0,
      burstUsed: 0,
      createdAt: Date.now(),
    };
    buckets.set(key, bucket);
  }
  return bucket;
}

function cleanup() {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (now - b.last > 60 * 1000) {
      buckets.delete(key);
    }
  }
}

export function rateLimiter(fastify) {
  fastify.addHook('onRequest', (request, reply, done) => {
    if (request.url === '/v1/health') return done();

    const tenantKey = request.tenantId || request.ip;
    const bucket = getBucket(tenantKey);

    const now = Date.now();
    const elapsed = (now - bucket.last) / 1000;
    if (elapsed > 0) {
      bucket.tokens += elapsed * RATE;
      if (bucket.tokens > BURST_RATE) bucket.tokens = BURST_RATE;
    }
    bucket.last = now;

    let allowed = false;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      allowed = true;
    } else {
      if (now - bucket.burstStart > BURST_DURATION * 1000) {
        bucket.burstStart = now;
        bucket.burstUsed = 0;
      }
      if (bucket.burstUsed < (BURST_RATE - RATE) * BURST_DURATION) {
        bucket.burstUsed += 1;
        allowed = true;
      }
    }

    if (!allowed) {
      reply
        .code(429)
        .header('Retry-After', '1')
        .send({ error: 'rate_limited', message: 'Per-tenant request quota exceeded' });
      return done();
    }

    if (now - bucket.createdAt > 60 * 1000) cleanup();

    done();
  });
}
