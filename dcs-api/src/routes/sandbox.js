import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';
import { requireOpsUser } from '../middleware/auth.js';
import { ApiError } from '../utils/errors.js';
import { prisma } from '../lib/prisma.js';
import { maskName } from '../utils/crypto.js';

export function registerSandboxRoutes(fastify) {
  fastify.get(
    '/v1/sandbox/customers',
    {
      schema: {
        summary: 'List sandbox customers for the demo app',
        tags: ['sandbox'],
      },
    },
    asyncHandler(async (_request, reply) => {
      const customers = await prisma.sandboxCustomer.findMany({
        where: { active: true },
        orderBy: [{ kind: 'asc' }, { external_ref: 'asc' }],
      });

      const accounts = await prisma.ledgerAccount.findMany({
        where: { external_ref: { in: customers.map((c) => c.external_ref) } },
      });
      const balanceByRef = new Map(accounts.map((a) => [a.external_ref, Number(a.balance)]));

      const senders = customers
        .filter((c) => c.kind === 'sender')
        .map((c) => ({
          external_ref: c.external_ref,
          registered_name: c.registered_name,
          display_name: maskName(c.registered_name),
          account_age_days: c.account_age_days,
          balance: balanceByRef.get(c.external_ref) ?? c.balance,
          note: c.note,
          known_devices: c.known_devices,
          typical_amount: c.typical_amount ? Number(c.typical_amount) : null,
          typical_recipients: c.typical_recipients,
        }));

      const recipients = customers
        .filter((c) => c.kind === 'recipient')
        .map((c) => ({
          external_ref: c.external_ref,
          registered_name: c.registered_name,
          display_name: maskName(c.registered_name),
          account_age_days: c.account_age_days,
          balance: balanceByRef.get(c.external_ref) ?? c.balance,
          note: c.note,
        }));

      reply.code(200).send({ senders, recipients });
    })
  );

  fastify.get(
    '/v1/sandbox/scenarios',
    {
      schema: {
        summary: 'List sandbox demo scenarios (built from the customer directory)',
        tags: ['sandbox'],
      },
    },
    asyncHandler(async (_request, reply) => {
      const scenarios = await prisma.sandboxScenario.findMany({
        where: { active: true },
        orderBy: { sort_order: 'asc' },
      });

      const customers = await prisma.sandboxCustomer.findMany({ where: { active: true } });
      const byRef = new Map(customers.map((c) => [c.external_ref, c]));

      const list = scenarios.map((sc) => {
        const sender = byRef.get(sc.sender_ref);
        const recipient = byRef.get(sc.recipient_ref);
        return {
          key: sc.key,
          tag: sc.tag,
          expected_decision: sc.expected_decision,
          title: sc.title,
          description: sc.description,
          flow: sc.flow,
          sort_order: sc.sort_order,
          preset: {
            sender: sc.sender_ref,
            sender_name: sender?.registered_name ?? null,
            sender_display_name: sender ? maskName(sender.registered_name) : null,
            recipient: sc.recipient_ref,
            recipient_name: recipient?.registered_name ?? null,
            recipient_display_name: recipient ? maskName(recipient.registered_name) : null,
            amount: sc.amount ? Number(sc.amount) : null,
            device_unknown: sc.device_unknown,
            night: sc.night,
          },
        };
      });

      reply.code(200).send({ scenarios: list });
    })
  );

  const CustomerCreateSchema = z.object({
    kind: z.enum(['sender', 'recipient']),
    external_ref: z.string().min(4).max(32),
    registered_name: z.string().min(2).max(120),
    account_age_days: z.number().int().min(0).max(20000),
    note: z.string().max(500).optional(),
    balance: z.number().int().min(0).optional().default(0),
    known_devices: z.array(z.string()).optional(),
    typical_amount: z.number().min(0).optional(),
    typical_recipients: z.array(z.string()).optional(),
  });

  fastify.post(
    '/v1/sandbox/customers',
    {
      preHandler: async (request) => { await requireOpsUser(request); },
      schema: { summary: 'Create a sandbox customer (also opens a ledger account)', tags: ['sandbox'] },
    },
    asyncHandler(async (request, reply) => {
      const p = CustomerCreateSchema.safeParse(request.body);
      if (!p.success) throw new ApiError(400, 'invalid_payload', 'Invalid payload', p.error.flatten());
      const d = p.data;
      const customer = await prisma.sandboxCustomer.create({
        data: {
          kind: d.kind, external_ref: d.external_ref, registered_name: d.registered_name,
          account_age_days: d.account_age_days, note: d.note, balance: d.balance,
          known_devices: d.known_devices ?? undefined,
          typical_amount: d.typical_amount ?? undefined,
          typical_recipients: d.typical_recipients ?? undefined,
        },
      });
      await prisma.ledgerAccount.upsert({
        where: { external_ref: d.external_ref },
        create: { external_ref: d.external_ref, kind: d.kind, name: d.registered_name, balance: d.balance },
        update: { name: d.registered_name },
      });
      reply.code(201).send({ external_ref: customer.external_ref, kind: customer.kind });
    })
  );

  fastify.patch(
    '/v1/sandbox/customers/:externalRef',
    {
      preHandler: async (request) => { await requireOpsUser(request); },
      schema: { summary: 'Update a sandbox customer (keeps ledger balance in sync)', tags: ['sandbox'] },
    },
    asyncHandler(async (request, reply) => {
      const ref = request.params.externalRef;
      const p = CustomerCreateSchema.partial().safeParse(request.body);
      if (!p.success) throw new ApiError(400, 'invalid_payload', 'Invalid payload', p.error.flatten());
      const d = p.data;
      const existing = await prisma.sandboxCustomer.findFirst({ where: { external_ref: ref } });
      if (!existing) throw new ApiError(404, 'not_found', 'Customer not found');
      const update = {};
      if (d.registered_name !== undefined) update.registered_name = d.registered_name;
      if (d.account_age_days !== undefined) update.account_age_days = d.account_age_days;
      if (d.note !== undefined) update.note = d.note;
      if (d.known_devices !== undefined) update.known_devices = d.known_devices;
      if (d.typical_amount !== undefined) update.typical_amount = d.typical_amount;
      if (d.typical_recipients !== undefined) update.typical_recipients = d.typical_recipients;
      await prisma.sandboxCustomer.update({ where: { id: existing.id }, data: update });

      const ledgerBalance = d.balance !== undefined ? d.balance : existing.balance;
      await prisma.ledgerAccount.upsert({
        where: { external_ref: ref },
        create: { external_ref: ref, kind: existing.kind, name: d.registered_name ?? existing.registered_name, balance: ledgerBalance },
        update: { name: d.registered_name ?? undefined, balance: d.balance !== undefined ? ledgerBalance : undefined },
      });
      const balance = await prisma.ledgerAccount.findUnique({ where: { external_ref: ref } });
      reply.code(200).send({ external_ref: ref, kind: existing.kind, balance: balance ? Number(balance.balance) : null });
    })
  );

  fastify.delete(
    '/v1/sandbox/customers/:externalRef',
    {
      preHandler: async (request) => { await requireOpsUser(request); },
      schema: { summary: 'Delete a sandbox customer (only when its ledger balance is zero)', tags: ['sandbox'] },
    },
    asyncHandler(async (request, reply) => {
      const ref = request.params.externalRef;
      const customer = await prisma.sandboxCustomer.findFirst({ where: { external_ref: ref } });
      if (!customer) throw new ApiError(404, 'not_found', 'Customer not found');
      const ledger = await prisma.ledgerAccount.findUnique({ where: { external_ref: ref } });
      if (ledger && Number(ledger.balance) !== 0) {
        throw new ApiError(409, 'conflict', 'Delete blocked: ledger balance is not zero (' + Number(ledger.balance) + ')');
      }
      await prisma.sandboxCustomer.deleteMany({ where: { external_ref: ref } });
      await prisma.ledgerAccount.deleteMany({ where: { external_ref: ref } });
      reply.code(200).send({ external_ref: ref, deleted: true });
    })
  );

  const ScenarioSchema = z.object({
    key: z.string().min(2).max(64),
    tag: z.string().min(1).max(40),
    expected_decision: z.enum(['allow', 'warn', 'hold', 'block']),
    title: z.string().min(2).max(120),
    description: z.string().max(500).optional(),
    flow: z.string().min(2).max(40),
    sender_ref: z.string().min(4),
    recipient_ref: z.string().min(4),
    amount: z.number().min(0).optional(),
    device_unknown: z.boolean().optional(),
    night: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  });

  fastify.post(
    '/v1/sandbox/scenarios',
    {
      preHandler: async (request) => { await requireOpsUser(request); },
      schema: { summary: 'Create a sandbox demo scenario', tags: ['sandbox'] },
    },
    asyncHandler(async (request, reply) => {
      const p = ScenarioSchema.safeParse(request.body);
      if (!p.success) throw new ApiError(400, 'invalid_payload', 'Invalid payload', p.error.flatten());
      const d = p.data;
      const sc = await prisma.sandboxScenario.create({
        data: {
          key: d.key, tag: d.tag, expected_decision: d.expected_decision, title: d.title,
          description: d.description ?? '', flow: d.flow, sender_ref: d.sender_ref, recipient_ref: d.recipient_ref,
          amount: d.amount ?? undefined, device_unknown: d.device_unknown ?? false, night: d.night ?? false,
          sort_order: d.sort_order ?? 0,
        },
      });
      reply.code(201).send({ key: sc.key });
    })
  );

  fastify.patch(
    '/v1/sandbox/scenarios/:key',
    {
      preHandler: async (request) => { await requireOpsUser(request); },
      schema: { summary: 'Update a sandbox demo scenario', tags: ['sandbox'] },
    },
    asyncHandler(async (request, reply) => {
      const key = request.params.key;
      const p = ScenarioSchema.omit({ key: true }).partial().safeParse(request.body);
      if (!p.success) throw new ApiError(400, 'invalid_payload', 'Invalid payload', p.error.flatten());
      const existing = await prisma.sandboxScenario.findUnique({ where: { key } });
      if (!existing) throw new ApiError(404, 'not_found', 'Scenario not found');
      await prisma.sandboxScenario.update({ where: { key }, data: p.data });
      reply.code(200).send({ key, updated: true });
    })
  );

  fastify.delete(
    '/v1/sandbox/scenarios/:key',
    {
      preHandler: async (request) => { await requireOpsUser(request); },
      schema: { summary: 'Delete a sandbox demo scenario', tags: ['sandbox'] },
    },
    asyncHandler(async (request, reply) => {
      const key = request.params.key;
      const existing = await prisma.sandboxScenario.findUnique({ where: { key } });
      if (!existing) throw new ApiError(404, 'not_found', 'Scenario not found');
      await prisma.sandboxScenario.delete({ where: { key } });
      reply.code(200).send({ key, deleted: true });
    })
  );
}