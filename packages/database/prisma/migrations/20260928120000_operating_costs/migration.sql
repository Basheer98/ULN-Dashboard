-- CreateTable
CREATE TABLE IF NOT EXISTS "operating_costs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'monthly',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "operating_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "operating_costs_is_active_idx" ON "operating_costs"("is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "operating_costs_category_id_idx" ON "operating_costs"("category_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'operating_costs_category_id_fkey'
  ) THEN
    ALTER TABLE "operating_costs"
      ADD CONSTRAINT "operating_costs_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
