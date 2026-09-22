import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api";

/**
 * Schema probe for production debugging.
 * GET /api/health/db — no auth (safe: only returns boolean checks, no data).
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; error?: string }> = {};

  async function probe(name: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      checks[name] = { ok: true };
    } catch (err) {
      checks[name] = {
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 240) : "unknown error",
      };
    }
  }

  await probe("connect", () => prisma.$queryRaw`SELECT 1`);
  await probe("projects_deleted_at", () =>
    prisma.project.count({ where: { deletedAt: null } })
  );
  await probe("projects_buried_aerial", () =>
    prisma.project.findFirst({
      select: { buriedSqft: true, aerialSqft: true },
    })
  );
  await probe("fielder_amount_paid", () =>
    prisma.fielderPayment.findFirst({
      select: { amountPaid: true, status: true },
    })
  );
  await probe("expense_work_state", () =>
    prisma.financialTransaction.findFirst({
      select: { workState: true },
    })
  );
  await probe("payment_events", () => prisma.fielderPaymentEvent.count());
  await probe("notifications", () => prisma.notification.count());

  const ok = Object.values(checks).every((c) => c.ok);
  return jsonOk(
    {
      status: ok ? "ok" : "schema_mismatch",
      hint: ok
        ? undefined
        : "Run: npm run db:migrate:deploy (Railway → service → Shell, or ensure startCommand includes migrate)",
      checks,
      timestamp: new Date().toISOString(),
    },
    ok ? 200 : 503
  );
}
