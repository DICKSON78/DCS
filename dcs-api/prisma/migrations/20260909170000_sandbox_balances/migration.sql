-- CreateTable: sandbox customer balance (demo wallet balance shown in the app UI)

ALTER TABLE "SandboxCustomer" ADD COLUMN "balance" INTEGER NOT NULL DEFAULT 0;

UPDATE "SandboxCustomer" SET "balance" = 2400000 WHERE "kind" = 'sender' AND "external_ref" = '2557000777';
UPDATE "SandboxCustomer" SET "balance" = 1200000 WHERE "kind" = 'sender' AND "external_ref" = '2557000888';
UPDATE "SandboxCustomer" SET "balance" = 180000  WHERE "kind" = 'sender' AND "external_ref" = '2557000999';
UPDATE "SandboxCustomer" SET "balance" = 4600000 WHERE "kind" = 'sender' AND "external_ref" = '2557001111';
UPDATE "SandboxCustomer" SET "balance" = 950000  WHERE "kind" = 'sender' AND "external_ref" = '2557001222';
UPDATE "SandboxCustomer" SET "balance" = 3750000 WHERE "kind" = 'sender' AND "external_ref" = '2557001333';