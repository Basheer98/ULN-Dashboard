import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk, jsonError } from "@/lib/api";
import { ensureProductionSchema } from "@/lib/ensure-schema";

/**
 * Schema probe for production debugging.
 * GET  /api/health/db
 * POST /api/health/db  — runs idempotent schema repair (no auth; only DDL IF NOT EXISTS)
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
        : "POST /api/health/db to auto-repair, or run: npm run db:migrate:deploy",
      checks,
      timestamp: new Date().toISOString(),
    },
    ok ? 200 : 503
  );
}

export async function POST(_request: NextRequest) {
  const result = await ensureProductionSchema();
  if (!result.ok) {
    return jsonError(`Schema repair failed: ${result.steps.join(" | ")}`, 500);
  }

  // Re-probe after repair
  try {
    await prisma.project.count({ where: { deletedAt: null } });
    await prisma.fielderPayment.findFirst({ select: { amountPaid: true } });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Repair ran but probes still failing",
      500
    );
  }

  return jsonOk({
    status: "repaired",
    steps: result.steps,
    timestamp: new Date().toISOString(),
  });
}
