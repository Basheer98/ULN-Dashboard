import type { Prisma } from "@uln/database";
import {
  calculateOperationsCost,
  isOperatingCostActiveInMonth,
  monthlyEquivalent,
  toNumber,
} from "@uln/shared";
import { prisma } from "./prisma";
import { computeProjectFinancials } from "./projects";

export const OPERATIONS_PERIOD_OPTIONS = [1, 3, 6, 12] as const;

const EXCLUDED_EXPENSE_STATUSES = ["draft", "rejected", "voided"] as const;

type MonthRange = { key: string; start: Date; end: Date };

export type CostLine = {
  key: string;
  label: string;
  detail?: string;
  amount: number;
  estimated: number;
  recorded: number;
};

export type ProjectOverheadRow = {
  id: string;
  projectNumber: string;
  clientName: string;
  completedAt: Date;
  sqft: number;
  revenue: number;
  fielderPay: number;
  otherVariableShare: number;
  overheadShare: number;
  net: number;
};

export function currentMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(value: string | undefined): string {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : currentMonthKey();
}

export function parsePeriodMonths(value: string | undefined): number {
  const n = Number(value);
  return (OPERATIONS_PERIOD_OPTIONS as readonly number[]).includes(n) ? n : 1;
}

function monthRanges(endMonth: string, months: number): MonthRange[] {
  const [year, month] = endMonth.split("-").map(Number);
  const ranges: MonthRange[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(year, month - 1 - i, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1) - 1);
    ranges.push({ key: currentMonthKey(start), start, end });
  }
  return ranges;
}

function addToLine(lines: Map<string, CostLine>, line: Omit<CostLine, "amount" | "estimated" | "recorded">, values: { estimated?: number; recorded?: number; amount: number }) {
  const existing = lines.get(line.key) ?? { ...line, amount: 0, estimated: 0, recorded: 0 };
  existing.amount += values.amount;
  existing.estimated += values.estimated ?? 0;
  existing.recorded += values.recorded ?? 0;
  lines.set(line.key, existing);
}

function sortedLines(lines: Map<string, CostLine>): CostLine[] {
  return Array.from(lines.values())
    .filter((l) => l.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Operating cost report for the `months` calendar months ending at `endMonth` (YYYY-MM, UTC).
 * Fixed costs: recurring operating costs plus loan interest and fees.
 * Variable costs: fielder pay for completed work, recorded expenses, mileage reimbursements.
 * Overhead is spread across completed projects by SQFT.
 */
export async function getOperationsCostReport(endMonth: string, months: number) {
  const ranges = monthRanges(endMonth, months);
  const from = ranges[0].start;
  const to = ranges[ranges.length - 1].end;

  const expenseStatusFilter: Prisma.FinancialTransactionWhereInput = {
    OR: [{ expenseStatus: null }, { expenseStatus: { notIn: [...EXCLUDED_EXPENSE_STATUSES] } }],
  };

  const [operatingCosts, expenses, mileage, loanPayments, projects] = await Promise.all([
    prisma.operatingCost.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { category: { select: { id: true, name: true } } },
    }),
    prisma.financialTransaction.findMany({
      where: {
        deletedAt: null,
        transactionType: "expense",
        transactionDate: { gte: from, lte: to },
        ...expenseStatusFilter,
      },
      select: {
        amount: true,
        transactionDate: true,
        categoryId: true,
        category: { select: { name: true } },
      },
    }),
    prisma.mileageEntry.findMany({
      where: {
        date: { gte: from, lte: to },
        isReimbursable: true,
        status: { notIn: [...EXCLUDED_EXPENSE_STATUSES] },
      },
      select: { reimbursement: true },
    }),
    prisma.loanPayment.findMany({
      where: { paidAt: { gte: from, lte: to } },
      select: {
        principalAmount: true,
        interestAmount: true,
        feeAmount: true,
        loan: { select: { lender: true } },
      },
    }),
    prisma.project.findMany({
      where: {
        deletedAt: null,
        completedAt: { gte: from, lte: to },
        status: { in: ["complete", "invoiced", "paid"] },
      },
      orderBy: { completedAt: "desc" },
      include: {
        client: { select: { name: true } },
        lineItems: true,
        assignments: {
          where: { status: { not: "cancelled" } },
          include: { fielder: true },
        },
      },
    }),
  ]);

  const fixedLines = new Map<string, CostLine>();
  const variableLines = new Map<string, CostLine>();

  for (const range of ranges) {
    const active = operatingCosts.filter((c) => isOperatingCostActiveInMonth(c, range.start, range.end));
    const monthExpenses = expenses.filter(
      (e) => e.transactionDate >= range.start && e.transactionDate <= range.end
    );

    const linkedEstimates = new Map<string, { label: string; names: string[]; estimate: number }>();
    for (const cost of active) {
      const monthly = monthlyEquivalent(toNumber(cost.amount), cost.frequency);
      if (cost.categoryId && cost.category) {
        const entry = linkedEstimates.get(cost.categoryId) ?? {
          label: cost.category.name,
          names: [],
          estimate: 0,
        };
        entry.names.push(cost.name);
        entry.estimate += monthly;
        linkedEstimates.set(cost.categoryId, entry);
      } else {
        addToLine(fixedLines, { key: `cost:${cost.id}`, label: cost.name }, {
          amount: monthly,
          estimated: monthly,
        });
      }
    }

    for (const [categoryId, entry] of linkedEstimates) {
      const recorded = monthExpenses
        .filter((e) => e.categoryId === categoryId)
        .reduce((s, e) => s + toNumber(e.amount), 0);
      const useRecorded = recorded > 0;
      addToLine(
        fixedLines,
        { key: `category:${categoryId}`, label: entry.label, detail: entry.names.join(", ") },
        {
          amount: useRecorded ? recorded : entry.estimate,
          estimated: useRecorded ? 0 : entry.estimate,
          recorded: useRecorded ? recorded : 0,
        }
      );
    }

    for (const expense of monthExpenses) {
      if (expense.categoryId && linkedEstimates.has(expense.categoryId)) continue;
      const amount = toNumber(expense.amount);
      addToLine(
        variableLines,
        {
          key: `expense:${expense.categoryId ?? "uncategorized"}`,
          label: expense.category?.name ?? "Uncategorized expenses",
        },
        { amount, recorded: amount }
      );
    }
  }

  let loanPrincipal = 0;
  for (const payment of loanPayments) {
    loanPrincipal += toNumber(payment.principalAmount);
    const interest = toNumber(payment.interestAmount) + toNumber(payment.feeAmount);
    if (interest > 0) {
      addToLine(
        fixedLines,
        { key: "loan-interest", label: "Loan interest & fees" },
        { amount: interest, recorded: interest }
      );
    }
  }

  const mileageTotal = mileage.reduce((s, m) => s + toNumber(m.reimbursement), 0);
  if (mileageTotal > 0) {
    addToLine(
      variableLines,
      { key: "mileage", label: "Mileage reimbursements" },
      { amount: mileageTotal, recorded: mileageTotal }
    );
  }

  const projectTotals = projects.map((project) => ({
    project,
    financials: computeProjectFinancials(project),
  }));
  const sqftCompleted = projectTotals.reduce((s, p) => s + p.financials.sqft, 0);
  const revenue = projectTotals.reduce((s, p) => s + p.financials.client.total, 0);
  const fielderPay = projectTotals.reduce((s, p) => s + p.financials.totalFielderPay, 0);

  const otherVariableCosts = sortedLines(variableLines).reduce((s, l) => s + l.amount, 0);
  if (fielderPay > 0) {
    addToLine(
      variableLines,
      { key: "fielder-pay", label: "Fielder pay", detail: "Completed projects in period" },
      { amount: fielderPay, recorded: fielderPay }
    );
  }

  const fixed = sortedLines(fixedLines);
  const fixedCosts = fixed.reduce((s, l) => s + l.amount, 0);

  const summary = calculateOperationsCost({
    months,
    sqftCompleted,
    revenue,
    fielderPay,
    fixedCosts,
    otherVariableCosts,
  });

  const projectRows: ProjectOverheadRow[] = projectTotals.map(({ project, financials }) => {
    const overheadShare = (summary.overheadPerSqft ?? 0) * financials.sqft;
    const otherVariableShare = (summary.otherVariablePerSqft ?? 0) * financials.sqft;
    return {
      id: project.id,
      projectNumber: project.projectNumber,
      clientName: project.client.name,
      completedAt: project.completedAt!,
      sqft: financials.sqft,
      revenue: financials.client.total,
      fielderPay: financials.totalFielderPay,
      otherVariableShare,
      overheadShare,
      net: financials.client.total - financials.totalFielderPay - otherVariableShare - overheadShare,
    };
  });

  const today = new Date();
  const recurringCosts = operatingCosts.map((c) => ({
    id: c.id,
    name: c.name,
    categoryId: c.categoryId,
    categoryName: c.category?.name ?? null,
    amount: toNumber(c.amount),
    frequency: c.frequency,
    monthlyAmount: monthlyEquivalent(toNumber(c.amount), c.frequency),
    startDate: c.startDate ? c.startDate.toISOString().slice(0, 10) : null,
    endDate: c.endDate ? c.endDate.toISOString().slice(0, 10) : null,
    isActive: c.isActive,
    notes: c.notes,
  }));
  const currentMonthlyFixed = operatingCosts
    .filter((c) => isOperatingCostActiveInMonth(c, today, today))
    .reduce((s, c) => s + monthlyEquivalent(toNumber(c.amount), c.frequency), 0);

  return {
    from,
    to,
    months,
    sqftCompleted,
    revenue,
    fielderPay,
    fixedCosts,
    otherVariableCosts,
    loanPrincipal,
    summary,
    fixedLines: fixed,
    variableLines: sortedLines(variableLines),
    projectRows,
    recurringCosts,
    currentMonthlyFixed,
  };
}

export type OperationsCostReport = Awaited<ReturnType<typeof getOperationsCostReport>>;
export type RecurringCostRow = OperationsCostReport["recurringCosts"][number];
