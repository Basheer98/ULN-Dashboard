-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'partial';

-- AlterTable
ALTER TABLE "fielder_payments" ADD COLUMN "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill paid rows so remaining owed is zero
UPDATE "fielder_payments"
SET "amount_paid" = "total_amount"
WHERE "status" = 'paid';

-- CreateTable
CREATE TABLE "fielder_payment_events" (
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

-- CreateIndex
CREATE INDEX "fielder_payment_events_payment_id_paid_at_idx" ON "fielder_payment_events"("payment_id", "paid_at");

-- AddForeignKey
ALTER TABLE "fielder_payment_events" ADD CONSTRAINT "fielder_payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "fielder_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fielder_payment_events" ADD CONSTRAINT "fielder_payment_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
