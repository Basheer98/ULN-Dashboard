-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "invoices_deleted_at_idx" ON "invoices"("deleted_at");
