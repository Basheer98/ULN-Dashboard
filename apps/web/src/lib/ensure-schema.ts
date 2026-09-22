/**
 * Idempotent schema repair for production when Prisma migrations did not apply
 * (common on Railway when startCommand is overridden or migrate history drifts).
 * Safe to run repeatedly — uses IF NOT EXISTS.
 */
export async function ensureProductionSchema(): Promise<{ ok: boolean; steps: string[] }> {
  const steps: string[] = [];

  // Dynamic import so edge/instrumentation bundling stays light
  const { prisma } = await import("./prisma");

  const run = async (label: string, sql: string) => {
    try {
      await prisma.$executeRawUnsafe(sql);
      steps.push(`ok:${label}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Ignore "already exists" style races
      if (/already exists|duplicate/i.test(msg)) {
        steps.push(`skip:${label}`);
        return;
      }
      steps.push(`fail:${label}:${msg.slice(0, 120)}`);
      throw err;
    }
  };

  try {
    await run(
      "projects.deleted_at",
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)`
    );
    await run(
      "projects.deleted_at_idx",
      `CREATE INDEX IF NOT EXISTS "projects_deleted_at_idx" ON "projects"("deleted_at")`
    );
    await run(
      "invoices.deleted_at",
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)`
    );
    await run(
      "invoices.deleted_at_idx",
      `CREATE INDEX IF NOT EXISTS "invoices_deleted_at_idx" ON "invoices"("deleted_at")`
    );
    await run(
      "project_titles",
      `CREATE TABLE IF NOT EXISTS "project_titles" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "project_titles_pkey" PRIMARY KEY ("id")
      )`
    );
    await run(
      "project_titles_name_key",
      `CREATE UNIQUE INDEX IF NOT EXISTS "project_titles_name_key" ON "project_titles"("name")`
    );
    await run(
      "project_titles_is_active_idx",
      `CREATE INDEX IF NOT EXISTS "project_titles_is_active_idx" ON "project_titles"("is_active")`
    );
    await run(
      "project_titles_backfill",
      `INSERT INTO "project_titles" ("id", "name", "is_active", "created_at", "updated_at")
       SELECT 'pt_' || md5(lower(trim(p.title))), trim(p.title), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       FROM (
         SELECT DISTINCT ON (lower(trim(title))) title
         FROM "projects"
         WHERE ("deleted_at" IS NULL) AND length(trim(title)) > 0
         ORDER BY lower(trim(title)), title
       ) p
       ON CONFLICT ("name") DO NOTHING`
    );
    await run(
      "projects.buried_sqft",
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "buried_sqft" DECIMAL(12,2)`
    );
    await run(
      "projects.aerial_sqft",
      `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "aerial_sqft" DECIMAL(12,2)`
    );
    await run(
      "ft.work_state",
      `ALTER TABLE "financial_transactions" ADD COLUMN IF NOT EXISTS "work_state" TEXT`
    );
    await run(
      "ft.work_state_idx",
      `CREATE INDEX IF NOT EXISTS "financial_transactions_work_state_idx" ON "financial_transactions"("work_state")`
    );
    await run(
      "fp.amount_paid",
      `ALTER TABLE "fielder_payments" ADD COLUMN IF NOT EXISTS "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0`
    );
    await run(
      "fp.amount_paid_backfill",
      `UPDATE "fielder_payments" SET "amount_paid" = "total_amount" WHERE "status" = 'paid' AND "amount_paid" = 0`
    );
    await run(
      "fielder_payment_events",
      `CREATE TABLE IF NOT EXISTS "fielder_payment_events" (
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
      )`
    );
    await run(
      "fielder_payment_events_idx",
      `CREATE INDEX IF NOT EXISTS "fielder_payment_events_payment_id_paid_at_idx" ON "fielder_payment_events"("payment_id", "paid_at")`
    );

    // Enums — best-effort (PG 15+ IF NOT EXISTS)
    for (const [label, sql] of [
      ["enum.PaymentStatus.partial", `ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'partial'`],
      ["enum.NotificationType.payment_pending", `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'payment_pending'`],
      ["enum.NotificationType.payment_approved", `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'payment_approved'`],
      ["enum.NotificationType.payment_sent", `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'payment_sent'`],
      ["enum.NotificationType.expense_approved", `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'expense_approved'`],
      ["enum.NotificationType.expense_rejected", `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'expense_rejected'`],
      ["enum.NotificationType.expense_reimbursed", `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'expense_reimbursed'`],
    ] as const) {
      try {
        await prisma.$executeRawUnsafe(sql);
        steps.push(`ok:${label}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        steps.push(`skip:${label}:${msg.slice(0, 80)}`);
      }
    }

    console.info("[ensure-schema]", steps.join(" | "));
    return { ok: true, steps };
  } catch (err) {
    console.error("[ensure-schema] failed", err);
    return { ok: false, steps };
  }
}
