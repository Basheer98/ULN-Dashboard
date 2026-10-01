-- CreateTable
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client" TEXT NOT NULL DEFAULT 'web',
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_fkey') THEN
    ALTER TABLE "sessions"
      ADD CONSTRAINT "sessions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "login_attempts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip_address" TEXT,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "login_attempts_email_created_at_idx" ON "login_attempts"("email", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "login_attempts_ip_address_created_at_idx" ON "login_attempts"("ip_address", "created_at");
