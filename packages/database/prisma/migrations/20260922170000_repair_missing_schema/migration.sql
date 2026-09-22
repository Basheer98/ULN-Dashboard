-- Repair / idempotent ensure for production DBs that missed recent columns.
-- Safe when columns/tables already exist (IF NOT EXISTS).

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "projects_deleted_at_idx" ON "projects"("deleted_at");

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "buried_sqft" DECIMAL(12,2);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "aerial_sqft" DECIMAL(12,2);

ALTER TABLE "financial_transactions" ADD COLUMN IF NOT EXISTS "work_state" TEXT;
CREATE INDEX IF NOT EXISTS "financial_transactions_work_state_idx" ON "financial_transactions"("work_state");

ALTER TABLE "fielder_payments" ADD COLUMN IF NOT EXISTS "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "fielder_payments"
SET "amount_paid" = "total_amount"
WHERE "status" = 'paid' AND "amount_paid" = 0;

CREATE TABLE IF NOT EXISTS "fielder_payment_events" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference_number" TEXT,
    "payment_method" TEXT,
    "notes" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fielder_payment_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fielder_payment_events_payment_id_paid_at_idx"
  ON "fielder_payment_events"("payment_id", "paid_at");

DO $$ BEGIN
  ALTER TABLE "fielder_payment_events"
    ADD CONSTRAINT "fielder_payment_events_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "fielder_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fielder_payment_events"
    ADD CONSTRAINT "fielder_payment_events_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum values (requires PostgreSQL 15+ for IF NOT EXISTS; Railway is typically 16+)
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'partial';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'payment_pending';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'payment_approved';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'payment_sent';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'expense_approved';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'expense_rejected';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'expense_reimbursed';
