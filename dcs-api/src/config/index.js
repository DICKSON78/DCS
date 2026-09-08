import 'dotenv/config';

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  port: parseInt(process.env.PORT || '8080', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  rateLimit: {
    perSecond: parseInt(process.env.RATE_LIMIT_PER_SECOND || '200', 10),
    burstPerSecond: parseInt(process.env.RATE_LIMIT_BURST_PER_SECOND || '400', 10),
    burstDuration: parseInt(process.env.RATE_LIMIT_BURST_DURATION || '10', 10),
  },
  sla: {
    validateP95Ms: parseInt(process.env.VALIDATE_P95_MS || '150', 10),
    validateP99Ms: parseInt(process.env.VALIDATE_P99_MS || '300', 10),
  },
  webhook: {
    retryMaxHours: parseInt(process.env.WEBHOOK_RETRY_MAX_HOURS || '24', 10),
  },
};
