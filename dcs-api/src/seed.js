import { prisma } from './lib/prisma.js';
import { sha256, hashIdentifier } from './utils/crypto.js';

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

const SENDERS = [
  { ref: '2557000777', name: 'Baraka Mwishi', age: 1850, note: 'Mfanyabiashara — akaunti ya miaka 5, kawaida anasafisha kuomba, hupenda kutuma asubuhi.', devices: ['device-a1', 'device-a2'], typical: 600000, recipients: ['255712345678', '255712345680'] },
  { ref: '2557000888', name: 'Neema Charles', age: 540, note: 'Mama wa kawaida — hutuma malipo ya shule kama kila mwezi.', devices: ['device-m2'], typical: 150000, recipients: ['255712345679'] },
  { ref: '2557000999', name: 'Juma Said', age: 0, note: 'Amejiunga LEO (day zero) — hii ni akaunti mpya kabisa.', devices: ['device-j3'], typical: 20000, recipients: [] },
  { ref: '2557111222', name: 'Zawadi Kato', age: 3, note: 'Akaunti ya siku 3 tu — je mdogo sana, angalia!', devices: ['device-z4'], typical: 50000, recipients: ['255713456789'] },
  { ref: '2557333444', name: 'Emmanuel Luoga', age: 900, note: 'Mfanyakazi wa kampuni — hupokea mshahara kwa benki hii.', devices: ['device-e5'], typical: 400000, recipients: ['255712345680', '255713456789'] },
  { ref: '2557555666', name: 'Aisha Mwakyusa', age: 2100, note: 'Mwenyekiti wa vikoba — hutuma kwa wanachama wake kupitia simu moja tu.', devices: ['device-a6'], typical: 350000, recipients: [] },
];

const RECIPIENTS = [
  { ref: '255712345678', name: 'Juma Mohamed', age: 1850, note: 'Mpokeaji anayejulikana — akaunti ya miaka 5.' },
  { ref: '255712345679', name: 'Amina Hassan', age: 12, note: 'Akaunti changa — siku 12 tu.' },
  { ref: '255712345680', name: 'Baraka Mwinyi', age: 3000, note: 'Mpokeaji mwenye historia ndefu.' },
  { ref: '255713456789', name: 'Neema Joseph', age: 540, note: 'Mpokeaji wa kawaida.' },
  { ref: '255714567890', name: 'Daudi Kileo', age: 2, note: 'Akaunti mpya kabisa — siku 2 tu, angalia!' },
];

for (const s of SENDERS) {
  await prisma.sandboxCustomer.upsert({
    where: { kind_external_ref: { kind: 'sender', external_ref: s.ref } },
    create: {
      kind: 'sender',
      external_ref: s.ref,
      registered_name: s.name,
      account_age_days: s.age,
      note: s.note,
      known_devices: s.devices,
      typical_amount: s.typical,
      typical_recipients: s.recipients,
    },
    update: {},
  });
}

for (const r of RECIPIENTS) {
  await prisma.sandboxCustomer.upsert({
    where: { kind_external_ref: { kind: 'recipient', external_ref: r.ref } },
    create: {
      kind: 'recipient',
      external_ref: r.ref,
      registered_name: r.name,
      account_age_days: r.age,
      note: r.note,
    },
    update: {},
  });
}

console.log(`Seeded sandbox directory: ${SENDERS.length} senders, ${RECIPIENTS.length} recipients.`);

const TENANT_ID = 'tenant-test-0001';
const firstSeenAt = (ageDays) => new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000).toISOString();

await prisma.customerBaseline.deleteMany({
  where: { tenant_id: TENANT_ID, user_external_ref: { in: SENDERS.map((s) => s.ref) } },
});

for (const s of SENDERS) {
  await prisma.customerBaseline.upsert({
    where: { tenant_id_user_external_ref: { tenant_id: TENANT_ID, user_external_ref: hashIdentifier(s.ref) } },
    create: {
      tenant_id: TENANT_ID,
      user_external_ref: hashIdentifier(s.ref),
      typical_amount: s.typical,
      typical_recipients: s.recipients.map(hashIdentifier),
      typical_time_of_day: 'day',
      known_devices: s.devices,
      first_seen_at: new Date(firstSeenAt(s.age)),
      tx_count_last_hour: 0,
      distinct_recipients_day: 0,
    },
    update: {
      typical_amount: s.typical,
      typical_recipients: s.recipients.map(hashIdentifier),
      typical_time_of_day: 'day',
      known_devices: s.devices,
      first_seen_at: new Date(firstSeenAt(s.age)),
      tx_count_last_hour: 0,
      distinct_recipients_day: 0,
      hour_window_start: null,
      day_window_start: null,
      updated_at: new Date(),
    },
  });
}

console.log(`Seeded behavioral baselines for ${SENDERS.length} senders under ${TENANT_ID} (hashed refs).`);

const SCENARIOS = [
  {
    key: 'a',
    tag: 'ALLOW',
    expected_decision: 'allow',
    title: 'Hadithi A — Tuma pesa kwa kawaida',
    description:
      'Baraka (mteja wa miaka 5) anamtuma Juma Mohamed ambaye anamfahamu — kifaa chake cha kawaida, asubuhi, kiasi cha kawaida. DCS inaamini: pesa zinafika salama.',
    flow: 'Thibitisha → score ya chini → ALLOW → SMS inafika kwa mpokeaji.',
    sender_ref: '2557000777',
    recipient_ref: '255712345678',
    amount: 60000,
    device_unknown: false,
    night: false,
    sort_order: 1,
  },
  {
    key: 'b',
    tag: 'HOLD + RUDISHA',
    expected_decision: 'hold',
    title: 'Hadithi B — Mtumiaji mwingine? Pesa zimezuiliwa',
    description:
      'Baraka anatumia simu mpya (haitambuliki) kwenda kwa Daudi Kileo, akaunti ya siku 2 tu. DCS haina uhakika: inazuia pesa (sio kuzipeleka), kisha mteja anaripoti “huyu si mtu wangu”, Ops wanafungia, uchunguzi unafanyika, na pesa zinarudishwa kwa Baraka.',
    flow: 'HOLD (pesa zimezuiliwa) → freeze na Ops → ripoti → uchunguzi → REFUND kwa Baraka.',
    sender_ref: '2557000777',
    recipient_ref: '255714567890',
    amount: 400000,
    device_unknown: true,
    night: false,
    sort_order: 2,
  },
  {
    key: 'c',
    tag: 'BLOCK',
    expected_decision: 'block',
    title: 'Hadithi C — Akaunti mpya, kiasi kikubwa',
    description:
      'Juma amejiunga leo (day zero), anajaribu kutuma TZS 200,000 kwa mtu asiyemjua kutoka kifaa kipya. Hii ni ishara ya barua kwa wadanganyifu: DCS inasitisha kabisa — pesa hazitoki nje.',
    flow: 'Kiangalizi cha hatari kimeanza → BLOCK → pesa hazikutoka kamwe.',
    sender_ref: '2557000999',
    recipient_ref: '255712345679',
    amount: 200000,
    device_unknown: true,
    night: true,
    sort_order: 3,
  },
];

for (const sc of SCENARIOS) {
  const { key, currency, ...rest } = sc;
  await prisma.sandboxScenario.upsert({
    where: { key },
    create: sc,
    update: rest,
  });
}

console.log(`Seeded sandbox scenarios: ${SCENARIOS.length} (Hadithi A/B/C).`);
await prisma.$disconnect();