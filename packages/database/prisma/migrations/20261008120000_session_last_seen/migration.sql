-- Web sessions expire after inactivity, tracked per session.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
