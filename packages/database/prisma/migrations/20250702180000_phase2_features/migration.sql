-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "push_token" TEXT;

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "assigned_sqft" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill assigned_sqft from project sqft for existing assignments
UPDATE "assignments" a
SET "assigned_sqft" = p."sqft"
FROM "projects" p
WHERE a."project_id" = p."id" AND a."assigned_sqft" = 0;
