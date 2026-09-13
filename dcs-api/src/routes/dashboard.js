import { asyncHandler } from '../utils/async-handler.js';
import { requireOpsUser } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const num = (v) => (v == null ? 0 : Number(v));

export function registerDashboardRoutes(fastify) {
  fastify.get(
    '/v1/ops/dashboard',
    {
      preHandler: async (request) => {
        await requireOpsUser(request);
      },
      schema: { summary: 'Ops dashboard overview: totals, decision split, escrow, recent activity', tags: ['ops'] },
    },
    asyncHandler(async (_request, reply) => {
      const [txnCount, cashMoved, escrow, activeHolds, openDisputes, recent, breakdown, entryCount] = await Promise.all([
        prisma.transaction.count(),
        prisma.ledgerEntry.aggregate({ where: { kind: 'transfer', direction: 'credit' }, _sum: { amount: true } }),
        prisma.ledgerAccount.findUnique({ where: { external_ref: '__ESCROW__' } }),
        prisma.hold.count({ where: { status: 'active' } }),
        prisma.dispute.count({ where: { status: 'open' } }),
        prisma.transaction.findMany({
          orderBy: { created_at: 'desc' },
          take: 12,
          include: { hold: true, reasonCodes: true },
        }),
        prisma.transaction.groupBy({ by: ['decision'], _count: true }),
        prisma.ledgerEntry.count(),
      ]);

      reply.code(200).send({
        totals: {
          transactions: txnCount,
          cash_moved_tzs: num(cashMoved._sum.amount),
          escrow_balance_tzs: num(escrow?.balance),
          active_holds: activeHolds,
          open_disputes: openDisputes,
          ledger_entries: entryCount,
        },
        decisions: Object.fromEntries(breakdown.map((b) => [b.decision, b._count])),
        recent: recent.map((t) => ({
          transaction_id: t.transaction_id,
          tenant_id: t.tenant_id,
          tenant_txn_ref: t.tenant_txn_ref,
          user_external_ref: t.user_external_ref,
          recipient_external_ref: t.recipient_external_ref,
          amount: num(t.amount),
          currency: t.currency,
          decision: t.decision,
          risk_score: t.risk_score,
          reason_codes: t.reasonCodes.map((r) => r.code),
          hold_status: t.hold?.status ?? null,
          created_at: t.created_at,
        })),
      });
    })
  );

  fastify.get(
    '/v1/ops/transactions',
    {
      preHandler: async (request) => {
        await requireOpsUser(request);
      },
      schema: { summary: 'List all transactions with optional filters', tags: ['ops'] },
    },
    asyncHandler(async (request, reply) => {
      const q = request.query || {};
      const limit = Math.min(num(q.limit) || 30, 200);
      const offset = num(q.offset) || 0;
      const where = {};
      if (q.decision) where.decision = q.decision;
      if (q.user_external_ref) where.user_external_ref = q.user_external_ref;
      if (q.sender_ref) where.sender_ref = q.sender_ref;
      if (q.tenant_id) where.tenant_id = q.tenant_id;

      const [rows, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: limit,
          skip: offset,
          include: { hold: true, reasonCodes: true },
        }),
        prisma.transaction.count({ where }),
      ]);

      reply.code(200).send({
        total,
        limit,
        offset,
        transactions: rows.map((t) => ({
          transaction_id: t.transaction_id,
          tenant_id: t.tenant_id,
          tenant_txn_ref: t.tenant_txn_ref,
          user_external_ref: t.user_external_ref,
          sender_ref: t.sender_ref,
          recipient_external_ref: t.recipient_external_ref,
          recipient_ref: t.recipient_ref,
          amount: num(t.amount),
          currency: t.currency,
          decision: t.decision,
          risk_score: t.risk_score,
          reason_codes: t.reasonCodes.map((r) => r.code),
          hold_status: t.hold?.status ?? null,
          created_at: t.created_at,
          occurred_at: t.occurred_at,
        })),
      });
    })
  );

  fastify.get(
    '/v1/ops/holds',
    {
      preHandler: async (request) => {
        await requireOpsUser(request);
      },
      schema: { summary: 'List holds with their linked transaction', tags: ['ops'] },
    },
    asyncHandler(async (request, reply) => {
      const q = request.query || {};
      const status = q.status || undefined;
      const where = status ? { status } : {};

      const holds = await prisma.hold.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: Math.min(num(q.limit) || 100, 200),
        include: { transaction: { include: { reasonCodes: true } } },
      });

      reply.code(200).send({
        holds: holds.map((h) => ({
          hold_id: h.hold_id,
          status: h.status,
          ttl_seconds: h.ttl_seconds,
          released_by: h.released_by,
          released_at: h.released_at,
          created_at: h.created_at,
          transaction: {
            transaction_id: h.transaction.transaction_id,
            user_external_ref: h.transaction.user_external_ref,
            sender_ref: h.transaction.sender_ref,
            recipient_ref: h.transaction.recipient_ref,
            amount: num(h.transaction.amount),
            currency: h.transaction.currency,
            decision: h.transaction.decision,
            risk_score: h.transaction.risk_score,
            reason_codes: h.transaction.reasonCodes.map((r) => r.code),
          },
        })),
      });
    })
  );

  fastify.get(
    '/v1/ops/disputes',
    {
      preHandler: async (request) => {
        await requireOpsUser(request);
      },
      schema: { summary: 'List disputes with their hold + transaction', tags: ['ops'] },
    },
    asyncHandler(async (request, reply) => {
      const q = request.query || {};
      const status = q.status || undefined;
      const where = status ? { status } : {};

      const disputes = await prisma.dispute.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: Math.min(num(q.limit) || 100, 200),
        include: { hold: { include: { transaction: true } }, analyst: true },
      });

      reply.code(200).send({
        disputes: disputes.map((d) => ({
          dispute_id: d.dispute_id,
          status: d.status,
          outcome: d.outcome,
          reason: d.reason,
          sla_due_at: d.sla_due_at,
          analyst_id: d.analyst_id,
          analyst_email: d.analyst?.email ?? null,
          resolved_at: d.resolved_at,
          created_at: d.created_at,
          hold_id: d.hold_id,
          transaction: {
            transaction_id: d.hold.transaction.transaction_id,
            user_external_ref: d.hold.transaction.user_external_ref,
            sender_ref: d.hold.transaction.sender_ref,
            recipient_ref: d.hold.transaction.recipient_ref,
            amount: num(d.hold.transaction.amount),
            currency: d.hold.transaction.currency,
          },
        })),
      });
    })
  );

  fastify.get(
    '/v1/ops/ledger',
    {
      preHandler: async (request) => {
        await requireOpsUser(request);
      },
      schema: { summary: 'Ledger accounts, escrow, and recent double-entry movements', tags: ['ops'] },
    },
    asyncHandler(async (request, reply) => {
      const q = request.query || {};
      const where = q.external_ref ? { external_ref: q.external_ref } : {};
      const accounts = await prisma.ledgerAccount.findMany({
        where,
        orderBy: { kind: 'asc' },
        take: Math.min(num(q.limit) || 100, 200),
      });
      const entriesWhere = q.external_ref ? { OR: [{ from_ref: q.external_ref }, { to_ref: q.external_ref }] } : {};
      const entries = await prisma.ledgerEntry.findMany({
        where: entriesWhere,
        orderBy: { created_at: 'desc' },
        take: Math.min(num(q.entries) || 30, 100),
      });

      reply.code(200).send({
        accounts: accounts.map((a) => ({
          external_ref: a.external_ref,
          kind: a.kind,
          name: a.name,
          balance: num(a.balance),
          updated_at: a.updated_at,
        })),
        entries: entries.map((e) => ({
          reference: e.reference,
          from_ref: e.from_ref,
          to_ref: e.to_ref,
          amount: num(e.amount),
          direction: e.direction,
          kind: e.kind,
          created_at: e.created_at,
        })),
      });
    })
  );
}