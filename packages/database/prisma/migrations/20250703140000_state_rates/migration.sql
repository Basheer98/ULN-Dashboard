-- CreateTable
CREATE TABLE IF NOT EXISTS "state_rates" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "client_sqft_rate" DECIMAL(10,4) NOT NULL,
    "fielder_sqft_rate" DECIMAL(10,4) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "state_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "state_rates_state_key" ON "state_rates"("state");
