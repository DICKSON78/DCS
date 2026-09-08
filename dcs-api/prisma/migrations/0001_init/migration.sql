-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Tenant" (
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenant_type" TEXT NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "signing_key_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "fail_policy" TEXT NOT NULL DEFAULT 'fail_open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "RecipientVerification" (
    "verification_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "recipient_external_ref" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "tenant_txn_ref" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "recipient_display_name" TEXT,
    "account_age_days" INTEGER,
    "first_time_recipient" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipientVerification_pkey" PRIMARY KEY ("verification_id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "transaction_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_txn_ref" TEXT NOT NULL,
    "user_external_ref" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient_external_ref" TEXT NOT NULL,
    "device_fingerprint" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "decision" TEXT NOT NULL,
    "risk_score" DOUBLE PRECISION,
    "model_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "ReasonCode" (
    "reason_code_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "ReasonCode_pkey" PRIMARY KEY ("reason_code_id")
);

-- CreateTable
CREATE TABLE "Hold" (
    "hold_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "ttl_seconds" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "released_by" TEXT,
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hold_pkey" PRIMARY KEY ("hold_id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "dispute_id" TEXT NOT NULL,
    "hold_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "sla_due_at" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT,
    "analyst_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("dispute_id")
);

-- CreateTable
CREATE TABLE "OpsUser" (
    "analyst_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'analyst',
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsUser_pkey" PRIMARY KEY ("analyst_id")
);

-- CreateTable
CREATE TABLE "WebhookSubscription" (
    "webhook_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "callback_url" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("webhook_id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "event_id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "CustomerBaseline" (
    "baseline_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_external_ref" TEXT NOT NULL,
    "typical_amount" DECIMAL(18,2),
    "typical_recipients" JSONB,
    "typical_time_of_day" TEXT,
    "known_devices" JSONB,
    "tx_count_last_hour" INTEGER NOT NULL DEFAULT 0,
    "hour_window_start" TIMESTAMP(3),
    "distinct_recipients_day" INTEGER NOT NULL DEFAULT 0,
    "day_window_start" TIMESTAMP(3),
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerBaseline_pkey" PRIMARY KEY ("baseline_id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "audit_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "prev_hash" TEXT,
    "entry_hash" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestNonce" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestNonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_api_key_hash_key" ON "Tenant"("api_key_hash");

-- CreateIndex
CREATE INDEX "RecipientVerification_tenant_id_idx" ON "RecipientVerification"("tenant_id");

-- CreateIndex
CREATE INDEX "Transaction_tenant_id_idx" ON "Transaction"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_tenant_id_tenant_txn_ref_key" ON "Transaction"("tenant_id", "tenant_txn_ref");

-- CreateIndex
CREATE INDEX "ReasonCode_transaction_id_idx" ON "ReasonCode"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "Hold_transaction_id_key" ON "Hold"("transaction_id");

-- CreateIndex
CREATE INDEX "Hold_status_idx" ON "Hold"("status");

-- CreateIndex
CREATE INDEX "Dispute_hold_id_idx" ON "Dispute"("hold_id");

-- CreateIndex
CREATE UNIQUE INDEX "OpsUser_email_key" ON "OpsUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookSubscription_tenant_id_key" ON "WebhookSubscription"("tenant_id");

-- CreateIndex
CREATE INDEX "WebhookSubscription_tenant_id_idx" ON "WebhookSubscription"("tenant_id");

-- CreateIndex
CREATE INDEX "WebhookEvent_webhook_id_idx" ON "WebhookEvent"("webhook_id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerBaseline_tenant_id_user_external_ref_key" ON "CustomerBaseline"("tenant_id", "user_external_ref");

-- CreateIndex
CREATE INDEX "AuditLog_tenant_id_idx" ON "AuditLog"("tenant_id");

-- CreateIndex
CREATE INDEX "AuditLog_tenant_id_timestamp_idx" ON "AuditLog"("tenant_id", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_request_id_tenant_id_key" ON "IdempotencyRecord"("request_id", "tenant_id");

-- CreateIndex
CREATE INDEX "RequestNonce_expires_at_idx" ON "RequestNonce"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "RequestNonce_nonce_tenant_id_key" ON "RequestNonce"("nonce", "tenant_id");

-- AddForeignKey
ALTER TABLE "RecipientVerification" ADD CONSTRAINT "RecipientVerification_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReasonCode" ADD CONSTRAINT "ReasonCode_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Transaction"("transaction_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Transaction"("transaction_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_hold_id_fkey" FOREIGN KEY ("hold_id") REFERENCES "Hold"("hold_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_analyst_id_fkey" FOREIGN KEY ("analyst_id") REFERENCES "OpsUser"("analyst_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "WebhookSubscription"("webhook_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBaseline" ADD CONSTRAINT "CustomerBaseline_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

