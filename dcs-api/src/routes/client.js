import { z } from 'zod';
import { asyncHandler } from '../utils/async-handler.js';
import { prisma } from '../lib/prisma.js';

export function registerClientRoutes(fastify) {
  const loginSchema = z.object({
    phone: z.string().min(1).max(32),
    pin: z.string().min(4).max(4).regex(/^\d{4}$/),
  });

  fastify.post(
    '/v1/client/login',
    {
      schema: {
        summary: 'Sign in to a sandbox account with phone + PIN (app-level login, still signed as tenant)',
        tags: ['client'],
        body: {
          type: 'object',
          required: ['phone', 'pin'],
          properties: {
            phone: { type: 'string' },
            pin: { type: 'string' },
          },
        },
      },
    },
    asyncHandler(async (request, reply) => {
      const { phone, pin } = loginSchema.parse({
        phone: request.body?.phone,
        pin: request.body?.pin,
      });

      const account = await prisma.sandboxCustomer.findFirst({
        where: { kind: 'sender', active: true, external_ref: phone },
      });

      if (!account) {
        reply.code(404).send({ error: 'account_not_found', message: 'Namba hii haijasajiliwa.' });
        return;
      }

      const expectedPin = phone.replace(/\D/g, '').slice(-4);
      if (pin !== expectedPin) {
        reply.code(401).send({ error: 'invalid_pin', message: 'PIN si sahihi — jaribu tena.' });
        return;
      }

      const ledger = await prisma.ledgerAccount.findUnique({
        where: { external_ref: account.external_ref },
      });

      reply.code(200).send({
        ok: true,
        account: {
          external_ref: account.external_ref,
          registered_name: account.registered_name,
          balance: Number(ledger?.balance ?? account.balance),
          account_age_days: account.account_age_days,
          known_devices: account.known_devices,
          typical_amount: account.typical_amount ? Number(account.typical_amount) : null,
        },
      });
    })
  );

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