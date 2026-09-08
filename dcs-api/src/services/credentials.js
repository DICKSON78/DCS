import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { sha256 } from '../utils/crypto.js';
import { ApiError } from '../utils/errors.js';
import { refreshTenantFromDb } from './tenant-registry.js';
import { createAuditLog } from './audit.js';

export const generateApiKey = () => crypto.randomBytes(24).toString('base64url');
export const generateSigningSecret = () => crypto.randomBytes(32).toString('base64url');

export async function rotateApiKey({ tenantId, actor }) {
  const tenant = await prisma.tenant.findUnique({ where: { tenant_id: tenantId } });
  if (!tenant) {
    throw new ApiError(404, 'tenant_not_found', 'Tenant not found');
  }

  const apiKey = generateApiKey();
  await prisma.tenant.update({
    where: { tenant_id: tenantId },
    data: { api_key_hash: sha256(apiKey) },
  });
  await refreshTenantFromDb(tenantId);
  await createAuditLog({
    tenantId,
    entityType: 'tenant',
    entityId: tenantId,
    action: 'api_key_rotated',
    actor,
  });

  return { tenant_id: tenantId, api_key: apiKey, previous_key_valid: false };
}

export async function rotateSigningKey({ tenantId, actor }) {
  const tenant = await prisma.tenant.findUnique({ where: { tenant_id: tenantId } });
  if (!tenant) {
    throw new ApiError(404, 'tenant_not_found', 'Tenant not found');
  }

  const signingSecret = generateSigningSecret();
  await prisma.tenant.update({
    where: { tenant_id: tenantId },
    data: { signing_key_hash: signingSecret },
  });
  await refreshTenantFromDb(tenantId);
  await createAuditLog({
    tenantId,
    entityType: 'tenant',
    entityId: tenantId,
    action: 'signing_key_rotated',
    actor,
  });

  return { tenant_id: tenantId, signing_secret: signingSecret, previous_secret_valid: false };
}