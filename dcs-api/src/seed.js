import { prisma } from './lib/prisma.js';
import { sha256 } from './utils/crypto.js';

await prisma.tenant.upsert({
  where: { tenant_id: 'tenant-test-0001' },
  create: {
    tenant_id: 'tenant-test-0001',
    name: 'Test Bank',
    tenant_type: 'bank',
    api_key_hash: sha256('test-api-key-0001'),
    signing_key_hash: 'test-signing-key-0001',
    status: 'active',
    fail_policy: 'fail_open',
  },
  update: {
    signing_key_hash: 'test-signing-key-0001',
    api_key_hash: sha256('test-api-key-0001'),
  },
});

await prisma.tenant.upsert({
  where: { tenant_id: 'tenant-mno-0002' },
  create: {
    tenant_id: 'tenant-mno-0002',
    name: 'Test MNO',
    tenant_type: 'mno',
    api_key_hash: sha256('mno-api-key-0002'),
    signing_key_hash: 'mno-signing-key-0002',
    status: 'active',
    fail_policy: 'fail_closed',
  },
  update: {
    signing_key_hash: 'mno-signing-key-0002',
    api_key_hash: sha256('mno-api-key-0002'),
  },
});

console.log('Seeded tenants with API keys and signing secrets:');
console.log('  tenant-test-0001  api_key=test-api-key-0001  signing=test-signing-key-0001  fail_policy=open');
console.log('  tenant-mno-0002   api_key=mno-api-key-0002   signing=mno-signing-key-0002  fail_policy=closed');
await prisma.$disconnect();