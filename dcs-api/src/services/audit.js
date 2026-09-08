import { prisma } from '../lib/prisma.js';
import { sha256 } from '../utils/crypto.js';

export async function createAuditLog({ tenantId, entityType, entityId, action, actor }) {
  const lastEntry = await prisma.auditLog.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { timestamp: 'desc' },
  });

  const prevHash = lastEntry?.entry_hash || '';
  const timestamp = new Date();
  const preimage = [
    prevHash,
    tenantId,
    entityType,
    entityId,
    action,
    actor || 'system',
    timestamp.toISOString(),
  ].join('|');

  return prisma.auditLog.create({
    data: {
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      actor: actor || 'system',
      prev_hash: prevHash || null,
      entry_hash: sha256(preimage),
      timestamp,
    },
  });
}

export async function verifyAuditChain(tenantId) {
  const entries = await prisma.auditLog.findMany({
    where: { tenant_id: tenantId },
    orderBy: { timestamp: 'asc' },
  });

  let prevHash = '';
  for (const entry of entries) {
    const preimage = [
      entry.prev_hash || '',
      entry.tenant_id,
      entry.entity_type,
      entry.entity_id,
      entry.action,
      entry.actor || 'system',
      entry.timestamp.toISOString(),
    ].join('|');
    const expected = sha256(preimage);

    if (entry.prev_hash !== (prevHash || null)) {
      return { valid: false, brokenAt: entry.audit_id, reason: 'prev_hash_chain_break' };
    }
    if (entry.entry_hash !== expected) {
      return { valid: false, brokenAt: entry.audit_id, reason: 'entry_hash_mismatch' };
    }
    prevHash = entry.entry_hash;
  }

  return { valid: true, entries: entries.length };
}