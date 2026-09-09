-- CreateTable
CREATE TABLE "SandboxCustomer" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "external_ref" TEXT NOT NULL,
    "registered_name" TEXT NOT NULL,
    "account_age_days" INTEGER NOT NULL,
    "note" TEXT,
    "known_devices" JSONB,
    "typical_amount" DECIMAL(18,2),
    "typical_recipients" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SandboxCustomer_kind_external_ref_key" ON "SandboxCustomer"("kind", "external_ref");

-- CreateIndex
CREATE INDEX "SandboxCustomer_kind_active_idx" ON "SandboxCustomer"("kind", "active");