import { prisma } from '../lib/prisma.js';

const cache = new Map();
let loaded = false;

export async function loadTenantRegistry() {
  const tenants = await prisma.tenant.findMany();
  cache.clear();
  for (const t of tenants) {
    cache.set(t.api_key_hash, {
      tenant_id: t.tenant_id,
      name: t.name,
      tenant_type: t.tenant_type,
      api_key_hash: t.api_key_hash,
      signing_key_hash: t.signing_key_hash,
      status: t.status,
      fail_policy: t.fail_policy,
    });
  }
  loaded = true;
  return cache.size;
}

export function isRegistryLoaded() {
  return loaded;
}

export function getTenantFromRegistry(apiKeyHash) {
  return cache.get(apiKeyHash) || null;
}

export async function resolveTenant(apiKeyHash) {
  const cached = getTenantFromRegistry(apiKeyHash);
  if (cached) return cached;

  try {
    const tenant = await prisma.tenant.findUnique({ where: { api_key_hash: apiKeyHash } });
    if (tenant) {
      const snapshot = {
        tenant_id: tenant.tenant_id,
        name: tenant.name,
        tenant_type: tenant.tenant_type,
        api_key_hash: tenant.api_key_hash,
        signing_key_hash: tenant.signing_key_hash,
        status: tenant.status,
        fail_policy: tenant.fail_policy,
      };
      cache.set(snapshot.api_key_hash, snapshot);
      return snapshot;
    }
    return null;
  } catch {
    return null;
  }
}