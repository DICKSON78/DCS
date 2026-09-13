import { asyncHandler } from '../utils/async-handler.js';
import { prisma } from '../lib/prisma.js';
import { maskName } from '../utils/crypto.js';

export function registerClientRoutes(fastify) {
  fastify.get(
    '/v1/client/directory',
    {
      schema: {
        summary: 'Directory of demo accounts & contacts for the client money app (signed as a tenant)',
        tags: ['client'],
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
          account_age_days: c.account_age_days,
          balance: balanceByRef.get(c.external_ref) ?? c.balance,
          known_devices: c.known_devices,
          typical_amount: c.typical_amount ? Number(c.typical_amount) : null,
        }));

      const recipients = customers
        .filter((c) => c.kind === 'recipient')
        .map((c) => ({
          external_ref: c.external_ref,
          registered_name: c.registered_name,
          account_age_days: c.account_age_days,
        }));

      reply.code(200).send({ senders, recipients });
    })
  );
}