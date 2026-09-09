import { asyncHandler } from '../utils/async-handler.js';
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
}