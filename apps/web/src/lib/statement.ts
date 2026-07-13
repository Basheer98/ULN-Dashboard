import { prisma } from "./prisma";
import { toNumber } from "@uln/shared";

export interface StatementLine {
  projectNumber: string;
  title: string;
  state: string | null;
  sqft: number;
  rate: number;
  sqftPay: number;
  extras: number;
  total: number;
  completedAt: Date | null;
  paymentStatus: string;
}

export interface FielderStatement {
  fielder: { id: string; firstName: string; lastName: string; employmentType: string; email: string | null };
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

/** monthStr = "YYYY-MM"; defaults to current month. */
export async function getFielderStatement(
  fielderId: string,
  monthStr?: string
): Promise<FielderStatement | null> {
  const fielder = await prisma.fielder.findUnique({ where: { id: fielderId } });
  if (!fielder) return null;

  const now = new Date();
  const [year, month] = monthStr
    ? monthStr.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];

  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 0, 23, 59, 59, 999);

  const assignments = await prisma.assignment.findMany({
    where: {
      fielderId,
      status: "complete",
      completedAt: { gte: from, lte: to },
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

    return {
      projectNumber: p.projectNumber,
      title: p.title,
      state: p.state,
      sqft,
      rate,
      sqftPay,
      extras,
      total: sqftPay + extras,
      completedAt: a.completedAt,
      paymentStatus: payment?.status ?? "not generated",
    };
  });

  const totals = lines.reduce(
    (acc, l) => {
      acc.projects += 1;
      acc.sqft += l.sqft;
      acc.sqftPay += l.sqftPay;
      acc.extras += l.extras;
      acc.total += l.total;
      if (l.paymentStatus === "paid") acc.paid += l.total;
      else acc.pending += l.total;
      return acc;
    },
    { projects: 0, sqft: 0, sqftPay: 0, extras: 0, total: 0, paid: 0, pending: 0 }
  );

  const monthLabel = from.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return {
    fielder: {
      id: fielder.id,
      firstName: fielder.firstName,
      lastName: fielder.lastName,
      employmentType: fielder.employmentType,
      email: fielder.email,
    },
    monthLabel,
    from,
    to,
    lines,
    totals,
  };
}
