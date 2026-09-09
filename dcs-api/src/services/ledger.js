import { prisma } from '../lib/prisma.js';
import { ApiError } from '../utils/errors.js';

export const ESCROW_REF = '__ESCROW__';

async function debit(tx, ref, amount) {
  const res = await tx.$executeRaw`
    UPDATE "LedgerAccount"
    SET "balance" = "balance" - ${amount}::numeric, "updated_at" = CURRENT_TIMESTAMP
    WHERE "external_ref" = ${ref} AND "balance" >= ${amount}::numeric`;
  if (res === 0) {
    throw new ApiError(400, 'insufficient_funds', `Salio la ${ref} halitoshi kwa mwendo huu`);
  }
}

async function credit(tx, ref, amount, kindForNew = 'recipient') {
  const upd = await tx.$executeRaw`
    UPDATE "LedgerAccount"
    SET "balance" = "balance" + ${amount}::numeric, "updated_at" = CURRENT_TIMESTAMP
    WHERE "external_ref" = ${ref}`;
  if (upd === 0) {
    await tx.ledgerAccount.upsert({
      where: { external_ref: ref },
      create: { external_ref: ref, kind: kindForNew, balance: amount },
      update: { balance: { increment: amount } },
    });
  }
}

async function record(tx, { reference, fromRef, toRef, amount, kind, direction }) {
  await tx.ledgerEntry.create({
    data: { reference, from_ref: fromRef, to_ref: toRef, amount, kind, direction },
  });
}

export function hasReserveFor(reference) {
  return prisma.ledgerEntry.findFirst({
    where: { reference, kind: 'hold_reserve', direction: 'credit' },
  });
}

export async function settleTransfer({ reference, fromRef, toRef, amount, kind }) {
  return prisma.$transaction(async (tx) => {
    await debit(tx, fromRef, amount);
    await record(tx, { reference, fromRef, toRef, amount, kind, direction: 'debit' });
    await credit(tx, toRef, amount);
    await record(tx, { reference, fromRef, toRef, amount, kind, direction: 'credit' });
    return {
      from: await tx.ledgerAccount.findUnique({ where: { external_ref: fromRef } }),
      to: await tx.ledgerAccount.findUnique({ where: { external_ref: toRef } }),
    };
  });
}

export async function releaseHeldFunds({ reference, toRef, amount, tx }) {
  const run = async (t) => {
    await debit(t, ESCROW_REF, amount);
    await record(t, { reference, fromRef: ESCROW_REF, toRef, amount, kind: 'hold_release', direction: 'debit' });
    await credit(t, toRef, amount);
    await record(t, { reference, fromRef: ESCROW_REF, toRef, amount, kind: 'hold_release', direction: 'credit' });
    return true;
  };
  return tx ? run(tx) : prisma.$transaction(run);
}

export async function refundHeldFunds({ reference, toRef, amount, tx }) {
  const run = async (t) => {
    await debit(t, ESCROW_REF, amount);
    await record(t, { reference, fromRef: ESCROW_REF, toRef, amount, kind: 'refund', direction: 'debit' });
    await credit(t, toRef, amount);
    await record(t, { reference, fromRef: ESCROW_REF, toRef, amount, kind: 'refund', direction: 'credit' });
    return true;
  };
  return tx ? run(tx) : prisma.$transaction(run);
}