import { sha256, constantTimeEqual } from '../utils/crypto.js';
import { ApiError, errorCodes } from '../utils/errors.js';
import { resolveTenant } from '../services/tenant-registry.js';

export async function authenticateTenant(request) {
  const apiKey = request.headers['x-tenant-key'];
  if (!apiKey) {
    throw new ApiError(401, 'invalid_key', 'X-Tenant-Key header is required');
  }

  const apiKeyHash = sha256(apiKey);
  const tenant = await resolveTenant(apiKeyHash);

  if (!tenant) {
    throw new ApiError(401, 'invalid_key', 'The provided API key is invalid');
  }

  if (tenant.status !== 'active') {
    throw new ApiError(401, 'invalid_key', 'The tenant account is not active');
  }

  request.tenant = tenant;
  request.tenantId = tenant.tenant_id;
}

export async function requireOpsUser(request) {
  const authHeader = request.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    throw new ApiError(401, 'invalid_key', 'Authorization header is required');
  }

  const expected = process.env.OPS_BEARER_TOKEN;
  if (!expected || !constantTimeEqual(token, expected)) {
    throw new ApiError(401, 'invalid_key', 'Invalid ops token');
  }
}
