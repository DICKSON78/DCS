-- Double-entry ledger: accounts + immutable entries + raw wallet refs on transactions

ALTER TABLE "Transaction" ADD COLUMN "sender_ref" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "recipient_ref" TEXT;

CREATE TABLE "LedgerAccount" (
  "id" TEXT NOT NULL,
  "external_ref" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "name" TEXT,
  "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LedgerAccount_external_ref_key" ON "LedgerAccount"("external_ref");

CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "from_ref" TEXT NOT NULL,
  "to_ref" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "direction" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LedgerEntry_reference_idx" ON "LedgerEntry"("reference");
CREATE INDEX "LedgerEntry_from_ref_idx" ON "LedgerEntry"("from_ref");
CREATE INDEX "LedgerEntry_to_ref_idx" ON "LedgerEntry"("to_ref");