-- CreateTable
CREATE TABLE IF NOT EXISTS "project_titles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_titles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_titles_name_key" ON "project_titles"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_titles_is_active_idx" ON "project_titles"("is_active");

-- Backfill from existing project titles (idempotent)
INSERT INTO "project_titles" ("id", "name", "is_active", "created_at", "updated_at")
SELECT
  'pt_' || md5(lower(trim(p.title))),
  trim(p.title),
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (lower(trim(title))) title
  FROM "projects"
  WHERE ("deleted_at" IS NULL) AND length(trim(title)) > 0
  ORDER BY lower(trim(title)), title
) p
ON CONFLICT ("name") DO NOTHING;
