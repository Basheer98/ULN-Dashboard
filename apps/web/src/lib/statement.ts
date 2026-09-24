import { prisma } from "./prisma";
import { toNumber } from "@uln/shared";

export interface StatementLine {
  projectId: string;
  projectNumber: string;
  title: string;
  state: string | null;
  buriedSqft: number | null;
  aerialSqft: number | null;
  sqft: number;
  rate: number;
  sqftPay: number;
  extras: number;
  total: number;
  completedAt: Date | null;
  assignedAt: Date | null;
  assignmentStatus: string;
  paymentStatus: string;
  amountPaid: number;
  amountOwed: number;
  /** active | pending | paid — for statement sections */
  bucket: "active" | "pending" | "paid";
}

export interface FielderStatement {
  fielder: {
    id: string;
    firstName: string;
    lastName: string;
    employmentType: string;
    email: string | null;
  };
  monthLabel: string;
  from: Date;
  to: Date;
  lines: StatementLine[];
  sections: {
    active: StatementLine[];
    pending: StatementLine[];
    paid: StatementLine[];
  };
  totals: {
    projects: number;
    sqft: number;
    sqftPay: number;
    extras: number;
    total: number;
    paid: number;
    pending: number;
    activeCount: number;
    pendingCount: number;
    paidCount: number;
  };
}

export type StatementRangeInput =
  | { month?: string; from?: undefined; to?: undefined }
  | { month?: undefined; from: string; to: string };

function parseLocalDate(value: string, endOfDay = false): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(value);
  if (endOfDay) return new Date(year, month - 1, day, 23, 59, 59, 999);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function resolveRange(input?: StatementRangeInput): { from: Date; to: Date; label: string } {
  if (input?.from && input?.to) {
    const from = parseLocalDate(input.from, false);
    const to = parseLocalDate(input.to, true);
    const label = `${from.toLocaleDateString()} – ${to.toLocaleDateString()}`;
    return { from, to, label };
  }

  const now = new Date();
  const monthStr = input && "month" in input ? input.month : undefined;
  const [year, month] = monthStr
    ? monthStr.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  const label = from.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return { from, to, label };
}

function inRange(date: Date | null | undefined, from: Date, to: Date): boolean {
  if (!date) return false;
  const t = date.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function bucketFor(line: {
  assignmentStatus: string;
  paymentStatus: string;
  amountPaid: number;
  amountOwed: number;
}): "active" | "pending" | "paid" {
  const activeStatuses = new Set(["assigned", "accepted", "in_progress"]);
  if (activeStatuses.has(line.assignmentStatus)) return "active";
  if (line.paymentStatus === "paid" || (line.amountPaid > 0 && line.amountOwed <= 0.009)) {
    return "paid";
  }
  return "pending";
}

/** month = "YYYY-MM" or explicit from/to ISO dates. */
export async function getFielderStatement(
  fielderId: string,
  range?: string | StatementRangeInput
): Promise<FielderStatement | null> {
  const fielder = await prisma.fielder.findUnique({ where: { id: fielderId } });
  if (!fielder) return null;

  const input: StatementRangeInput =
    typeof range === "string" ? { month: range } : range ?? {};
  const { from, to, label } = resolveRange(input);

  const [assignments, payments] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        fielderId,
        status: { not: "cancelled" },
        project: { deletedAt: null },
      },
      include: {
        project: {
          include: {
            lineItems: true,
            payments: { where: { fielderId } },
          },
        },
      },
      orderBy: [{ completedAt: "asc" }, { assignedAt: "asc" }],
    }),
    prisma.fielderPayment.findMany({
      where: {
        fielderId,
        project: { deletedAt: null },
      },
      include: {
        project: {
          include: {
            lineItems: true,
          },
        },
      },
    }),
  ]);

  const byProject = new Map<string, StatementLine>();

  function upsertFromAssignment(
    a: (typeof assignments)[number],
    paymentOverride?: (typeof payments)[number] | null
  ) {
    const p = a.project;
    const sqft = toNumber(a.assignedSqft) || toNumber(p.sqft);
    const rate = toNumber(a.fielderSqftRate);
    const sqftPay = sqft * rate;
    const extras = p.lineItems
      .filter((l) => l.type === "fielder_payout" && (l.fielderId === fielderId || !l.fielderId))
      .reduce((s, l) => s + toNumber(l.amount), 0);
    const payment = paymentOverride ?? p.payments[0] ?? null;
    const amountPaid = payment ? toNumber(payment.amountPaid) : 0;
    const total = sqftPay + extras;
    const owed = payment ? toNumber(payment.totalAmount) : total;
    const amountOwed = Math.max(0, owed - amountPaid);
    const paymentStatus = payment?.status ?? "not generated";
    const assignmentStatus = a.status;
    const lineBase = {
      assignmentStatus,
      paymentStatus,
      amountPaid,
      amountOwed,
    };

    byProject.set(p.id, {
      projectId: p.id,
      projectNumber: p.projectNumber,
      title: p.title,
      state: p.state,
      buriedSqft: p.buriedSqft != null ? toNumber(p.buriedSqft) : null,
      aerialSqft: p.aerialSqft != null ? toNumber(p.aerialSqft) : null,
      sqft,
      rate,
      sqftPay,
      extras,
      total,
      completedAt: a.completedAt,
      assignedAt: a.assignedAt,
      assignmentStatus,
      paymentStatus,
      amountPaid,
      amountOwed,
      bucket: bucketFor(lineBase),
    });
  }

  // Active work always appears (so statements aren't empty when jobs aren't marked complete).
  for (const a of assignments) {
    if (["assigned", "accepted", "in_progress"].includes(a.status)) {
      upsertFromAssignment(a);
    }
  }

  // Completed work in the selected period (completedAt, else assignedAt).
  for (const a of assignments) {
    if (a.status !== "complete") continue;
    const activityDate = a.completedAt ?? a.assignedAt;
    if (!inRange(activityDate, from, to)) continue;
    upsertFromAssignment(a);
  }

  // Payments in period or still outstanding — cover jobs that never got assignment.complete.
  for (const payment of payments) {
    if (!payment.project) continue;
    const outstanding = ["pending", "approved", "partial"].includes(payment.status);
    const paidInRange =
      inRange(payment.paidAt, from, to) ||
      (payment.status === "paid" && inRange(payment.createdAt, from, to));
    const createdInRange = inRange(payment.createdAt, from, to);

    if (!outstanding && !paidInRange && !createdInRange) continue;

    const assignment = assignments.find((a) => a.projectId === payment.projectId) ?? null;

    if (assignment) {
      upsertFromAssignment(assignment, payment);
      continue;
    }

    // Payment with no assignment row — still show from project + payment.
    const p = payment.project;
    const sqft = toNumber(p.sqft);
    const rate = 0;
    const sqftPay = toNumber(payment.sqftAmount);
    const extras = toNumber(payment.lineItemsTotal);
    const total = toNumber(payment.totalAmount);
    const amountPaid = toNumber(payment.amountPaid);
    const amountOwed = Math.max(0, total - amountPaid);
    const lineBase = {
      assignmentStatus: "complete",
      paymentStatus: payment.status,
      amountPaid,
      amountOwed,
    };
    byProject.set(p.id, {
      projectId: p.id,
      projectNumber: p.projectNumber,
      title: p.title,
      state: p.state,
      buriedSqft: p.buriedSqft != null ? toNumber(p.buriedSqft) : null,
      aerialSqft: p.aerialSqft != null ? toNumber(p.aerialSqft) : null,
      sqft,
      rate,
      sqftPay,
      extras,
      total,
      completedAt: p.completedAt,
      assignedAt: null,
      assignmentStatus: "complete",
      paymentStatus: payment.status,
      amountPaid,
      amountOwed,
      bucket: bucketFor(lineBase),
    });
  }

  const lines = Array.from(byProject.values()).sort((a, b) => {
    const da = (a.completedAt ?? a.assignedAt)?.getTime() ?? 0;
    const db = (b.completedAt ?? b.assignedAt)?.getTime() ?? 0;
    return da - db;
  });

  const sections = {
    active: lines.filter((l) => l.bucket === "active"),
    pending: lines.filter((l) => l.bucket === "pending"),
    paid: lines.filter((l) => l.bucket === "paid"),
  };

  const totals = lines.reduce(
    (acc, l) => {
      acc.projects += 1;
      acc.sqft += l.sqft;
      acc.sqftPay += l.sqftPay;
      acc.extras += l.extras;
      acc.total += l.total;
      acc.paid += l.amountPaid;
      acc.pending += l.amountOwed;
      return acc;
    },
    {
      projects: 0,
      sqft: 0,
      sqftPay: 0,
      extras: 0,
      total: 0,
      paid: 0,
      pending: 0,
      activeCount: sections.active.length,
      pendingCount: sections.pending.length,
      paidCount: sections.paid.length,
    }
  );
  totals.activeCount = sections.active.length;
  totals.pendingCount = sections.pending.length;
  totals.paidCount = sections.paid.length;

  return {
    fielder: {
      id: fielder.id,
      firstName: fielder.firstName,
      lastName: fielder.lastName,
      employmentType: fielder.employmentType,
      email: fielder.email,
    },
    monthLabel: label,
    from,
    to,
    lines,
    sections,
    totals,
  };
}
