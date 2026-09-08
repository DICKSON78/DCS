import 'dotenv/config';
import fs from 'node:fs';

function loadSecret(envKey, fileKey) {
  if (process.env[fileKey]) {
    return fs.readFileSync(process.env[fileKey], 'utf8').trim();
  }
  return process.env[envKey];
}

function loadTlsFile(filePath) {
  if (!filePath) return undefined;
  return fs.readFileSync(filePath);
}

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  port: parseInt(process.env.PORT || '8080', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  opsBearerToken: loadSecret('OPS_BEARER_TOKEN', 'OPS_BEARER_TOKEN_FILE'),
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
  tls: {
    enabled: process.env.TLS_ENABLED === 'true',
    key: loadTlsFile(process.env.TLS_KEY_FILE),
    cert: loadTlsFile(process.env.TLS_CERT_FILE),
    ca: loadTlsFile(process.env.TLS_CA_FILE),
    requestClientCert: process.env.TLS_REQUEST_CLIENT_CERT === 'true',
    rejectUnauthorized: process.env.TLS_REJECT_UNAUTHORIZED !== 'false',
    outboundCert: loadTlsFile(process.env.WEBHOOK_CLIENT_CERT_FILE),
    outboundKey: loadTlsFile(process.env.WEBHOOK_CLIENT_KEY_FILE),
    outboundCa: loadTlsFile(process.env.WEBHOOK_CA_FILE),
  },
};
