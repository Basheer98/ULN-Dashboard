-- AlterTable
ALTER TABLE "financial_transactions" ADD COLUMN "work_state" TEXT;

-- CreateIndex
CREATE INDEX "financial_transactions_work_state_idx" ON "financial_transactions"("work_state");
