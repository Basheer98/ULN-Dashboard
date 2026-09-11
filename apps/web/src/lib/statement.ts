import { prisma } from "./prisma";
import { toNumber } from "@uln/shared";

export interface StatementLine {
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
  paymentStatus: string;
  amountPaid: number;
  amountOwed: number;
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
  totals: {
    projects: number;
    sqft: number;
    sqftPay: number;
    extras: number;
    total: number;
    paid: number;
    pending: number;
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

/** month = "YYYY-MM" or explicit from/to ISO dates. */
export async function getFielderStatement(
  fielderId: string,
  range?: string | StatementRangeInput
): Promise<FielderStatement | null> {
  const fielder = await prisma.fielder.findUnique({ where: { id: fielderId } });
  if (!fielder) return null;

  const input: StatementRangeInput =
    typeof range === "string"
      ? { month: range }
      : range ?? {};
  const { from, to, label } = resolveRange(input);

  const assignments = await prisma.assignment.findMany({
    where: {
      fielderId,
      status: "complete",
      completedAt: { gte: from, lte: to },
      project: { deletedAt: null },
    },
    include: {
      project: { include: { lineItems: true, payments: true } },
    },
    orderBy: { completedAt: "asc" },
  });

  const lines: StatementLine[] = assignments.map((a) => {
    const p = a.project;
    const sqft = toNumber(a.assignedSqft) || toNumber(p.sqft);
    const rate = toNumber(a.fielderSqftRate);
    const sqftPay = sqft * rate;
    const extras = p.lineItems
      .filter((l) => l.type === "fielder_payout" && (l.fielderId === fielderId || !l.fielderId))
      .reduce((s, l) => s + toNumber(l.amount), 0);
    const payment = p.payments.find((pm) => pm.fielderId === fielderId);
    const amountPaid = payment ? toNumber(payment.amountPaid) : 0;
    const total = sqftPay + extras;
    const owed = payment ? toNumber(payment.totalAmount) : total;

    return {
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
      paymentStatus: payment?.status ?? "not generated",
      amountPaid,
      amountOwed: Math.max(0, owed - amountPaid),
    };
  });

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
    { projects: 0, sqft: 0, sqftPay: 0, extras: 0, total: 0, paid: 0, pending: 0 }
  );

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
    totals,
  };
}
