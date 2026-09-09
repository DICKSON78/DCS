<!-- CreateTable -->
CREATE TABLE "SandboxScenario" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "expected_decision" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "sender_ref" TEXT NOT NULL,
    "recipient_ref" TEXT NOT NULL,
    "amount" DECIMAL(18,2),
    "device_unknown" BOOLEAN NOT NULL DEFAULT false,
    "night" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SandboxScenario_key_key" ON "SandboxScenario"("key");

-- CreateIndex
CREATE INDEX "SandboxScenario_active_sort_order_idx" ON "SandboxScenario"("active", "sort_order");