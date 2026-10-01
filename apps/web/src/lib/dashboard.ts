import type { UserRole } from "@uln/database";
import { canViewProjectFinancials, hasPermission, toNumber } from "@uln/shared";
import { prisma } from "./prisma";
import { computeProjectFinancials } from "./projects";
import { currentMonthKey, getOperationsCostReport } from "./operations-cost";

const OPEN_STATUSES = ["draft", "assigned", "in_progress"] as const;
const COMPLETED_STATUSES = ["complete", "invoiced", "paid"] as const;
const PENDING_REVIEW = ["submitted", "pending_review"] as const;

export type Trend = { current: number; previous: number };

export type AttentionItem = {
  key: string;
  label: string;
  count: number;
  amount?: number;
  href: string;
};

export type BreakEvenProgress =
  | { state: "no_costs" }
  | { state: "no_history" }
  | {
      state: "ready";
      targetSqft: number;
      completedSqft: number;
      monthProgress: number;
    };

/** Month-to-date vs the same number of days into last month (UTC). */
function comparisonWindows(now: Date) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const elapsed = now.getTime() - monthStart.getTime();
  const lastMonthCutoff = new Date(Math.min(lastMonthStart.getTime() + elapsed, monthStart.getTime() - 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    monthStart,
    lastMonthStart,
    lastMonthCutoff,
    monthProgress: elapsed / (nextMonthStart.getTime() - monthStart.getTime()),
  };
}

function previousMonthKey(now: Date): string {
  return currentMonthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

async function getBreakEvenProgress(now: Date, completedSqft: number, monthProgress: number): Promise<BreakEvenProgress> {
  const report = await getOperationsCostReport(previousMonthKey(now), 3);
  if (report.currentMonthlyFixed === 0 && report.fixedCosts === 0) return { state: "no_costs" };
  if (report.summary.breakEvenSqftPerMonth == null) return { state: "no_history" };
  return {
    state: "ready",
    targetSqft: report.summary.breakEvenSqftPerMonth,
    completedSqft,
    monthProgress,
  };
}

export async function getDashboardData(role: UserRole, now = new Date()) {
  const canSeeMoney = canViewProjectFinancials(role);
  const canSeeFinance = hasPermission(role, "finance:read") || hasPermission(role, "finance:admin");
  const canDispatch = hasPermission(role, "projects:write");
  const canSeeInvoices = hasPermission(role, "invoices:read");
  const canSeePayouts = hasPermission(role, "payments:read");
  const canReviewExpenses = hasPermission(role, "finance:write") || hasPermission(role, "finance:admin");

  const { monthStart, lastMonthStart, lastMonthCutoff, monthProgress } = comparisonWindows(now);
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    completedRecently,
    createdThisMonth,
    createdLastMonth,
    activeProjects,
    unassignedProjects,
    dueThisWeek,
    readyToInvoice,
    draftInvoices,
    unpaidInvoices,
    pendingPayouts,
    expensesToReview,
    mileageToReview,
    cashAccounts,
  ] = await Promise.all([
    prisma.project.findMany({
      where: {
        deletedAt: null,
        status: { in: [...COMPLETED_STATUSES] },
        completedAt: { gte: lastMonthStart, lte: now },
      },
      select: {
        completedAt: true,
        sqft: true,
        clientSqftRate: true,
        lineItems: { select: { type: true, amount: true, fielderId: true } },
        assignments: {
          where: { status: { not: "cancelled" } },
          select: {
            id: true,
            fielderId: true,
            fielderSqftRate: true,
            assignedSqft: true,
            fielder: { select: { firstName: true, lastName: true, employmentType: true } },
          },
        },
      },
    }),
    prisma.project.count({ where: { deletedAt: null, createdAt: { gte: monthStart } } }),
    prisma.project.count({
      where: { deletedAt: null, createdAt: { gte: lastMonthStart, lte: lastMonthCutoff } },
    }),
    prisma.project.findMany({
      where: { deletedAt: null, status: { in: ["assigned", "in_progress"] } },
      select: { sqft: true },
    }),
    prisma.project.count({
      where: {
        deletedAt: null,
        status: { in: [...OPEN_STATUSES] },
        assignments: { none: { status: { not: "cancelled" } } },
      },
    }),
    prisma.project.count({
      where: {
        deletedAt: null,
        status: { in: [...OPEN_STATUSES] },
        dueDate: { gte: now, lte: weekAhead },
      },
    }),
    canSeeInvoices
      ? prisma.project.findMany({
          where: { deletedAt: null, status: "complete" },
          select: { sqft: true, clientSqftRate: true, lineItems: { select: { type: true, amount: true } } },
        })
      : Promise.resolve([]),
    canSeeInvoices
      ? prisma.invoice.aggregate({
          where: { deletedAt: null, status: "draft" },
          _count: true,
          _sum: { totalAmount: true },
        })
      : Promise.resolve(null),
    canSeeInvoices
      ? prisma.invoice.findMany({
          where: { deletedAt: null, status: { in: ["sent", "overdue", "partial"] } },
          select: { totalAmount: true, invoicePayments: { select: { amount: true } } },
        })
      : Promise.resolve([]),
    canSeePayouts
      ? prisma.fielderPayment.findMany({
          where: { status: { in: ["pending", "approved", "partial"] } },
          select: { status: true, totalAmount: true, amountPaid: true },
        })
      : Promise.resolve([]),
    canReviewExpenses
      ? prisma.financialTransaction.aggregate({
          where: {
            deletedAt: null,
            transactionType: "expense",
            expenseStatus: { in: [...PENDING_REVIEW] },
          },
          _count: true,
          _sum: { amount: true },
        })
      : Promise.resolve(null),
    canReviewExpenses
      ? prisma.mileageEntry.aggregate({
          where: { status: { in: [...PENDING_REVIEW] } },
          _count: true,
          _sum: { reimbursement: true },
        })
      : Promise.resolve(null),
    canSeeFinance
      ? prisma.paymentMethod.findMany({
          where: { isActive: true, includeInDashboard: true },
          select: { currentBalance: true },
        })
      : Promise.resolve([]),
  ]);

  const sqftTrend: Trend = { current: 0, previous: 0 };
  const completedTrend: Trend = { current: 0, previous: 0 };
  const billedTrend: Trend = { current: 0, previous: 0 };
  const marginTrend: Trend = { current: 0, previous: 0 };
  for (const project of completedRecently) {
    const completedAt = project.completedAt!;
    const bucket = completedAt >= monthStart ? "current" : completedAt <= lastMonthCutoff ? "previous" : null;
    if (!bucket) continue;
    const financials = computeProjectFinancials(project);
    sqftTrend[bucket] += financials.sqft;
    completedTrend[bucket] += 1;
    billedTrend[bucket] += financials.client.total;
    marginTrend[bucket] += financials.margin;
  }

  const clientTotal = (p: { sqft: unknown; clientSqftRate: unknown; lineItems: { type: string; amount: unknown }[] }) =>
    toNumber(p.sqft) * toNumber(p.clientSqftRate) +
    p.lineItems.filter((l) => l.type === "client_billing").reduce((s, l) => s + toNumber(l.amount), 0);

  const attention: AttentionItem[] = [];
  if (canDispatch) {
    attention.push(
      { key: "unassigned", label: "Projects with no fielder assigned", count: unassignedProjects, href: "/projects?status=draft" },
      { key: "due-week", label: "Jobs due in the next 7 days", count: dueThisWeek, href: "/schedule" }
    );
  }
  if (canSeeInvoices) {
    attention.push(
      {
        key: "ready-to-invoice",
        label: "Completed projects ready to invoice",
        count: readyToInvoice.length,
        amount: readyToInvoice.reduce((s, p) => s + clientTotal(p), 0),
        href: "/projects?status=complete",
      },
      {
        key: "draft-invoices",
        label: "Draft invoices to send",
        count: draftInvoices?._count ?? 0,
        amount: toNumber(draftInvoices?._sum.totalAmount),
        href: "/invoices",
      }
    );
  }
  if (canSeePayouts) {
    const toApprove = pendingPayouts.filter((p) => p.status === "pending");
    const toPay = pendingPayouts.filter((p) => p.status !== "pending");
    attention.push(
      {
        key: "payouts-approve",
        label: "Fielder payouts to approve",
        count: toApprove.length,
        amount: toApprove.reduce((s, p) => s + toNumber(p.totalAmount), 0),
        href: "/payments",
      },
      {
        key: "payouts-pay",
        label: "Approved payouts waiting to be paid",
        count: toPay.length,
        amount: toPay.reduce((s, p) => s + toNumber(p.totalAmount) - toNumber(p.amountPaid), 0),
        href: "/payments",
      }
    );
  }
  if (canReviewExpenses) {
    attention.push(
      {
        key: "expenses",
        label: "Expenses waiting for approval",
        count: expensesToReview?._count ?? 0,
        amount: toNumber(expensesToReview?._sum.amount),
        href: "/finance/expenses/approvals",
      },
      {
        key: "mileage",
        label: "Mileage entries waiting for approval",
        count: mileageToReview?._count ?? 0,
        amount: toNumber(mileageToReview?._sum.reimbursement),
        href: "/finance/mileage",
      }
    );
  }

  const breakEven = canSeeFinance ? await getBreakEvenProgress(now, sqftTrend.current, monthProgress) : null;

  return {
    canSeeMoney,
    canSeeFinance,
    canSeeInvoices,
    monthLabel: monthStart.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }),
    trends: {
      sqft: sqftTrend,
      completed: completedTrend,
      created: { current: createdThisMonth, previous: createdLastMonth } satisfies Trend,
      billed: canSeeMoney ? billedTrend : null,
      margin: canSeeMoney ? marginTrend : null,
    },
    activeProjectCount: activeProjects.length,
    pipelineSqft: activeProjects.reduce((s, p) => s + toNumber(p.sqft), 0),
    unassignedProjects,
    dueThisWeek,
    unpaidInvoices: canSeeInvoices
      ? {
          count: unpaidInvoices.length,
          amount: unpaidInvoices.reduce(
            (s, inv) =>
              s +
              Math.max(
                0,
                toNumber(inv.totalAmount) - inv.invoicePayments.reduce((p, pay) => p + toNumber(pay.amount), 0)
              ),
            0
          ),
        }
      : null,
    cashOnHand: canSeeFinance ? cashAccounts.reduce((s, a) => s + toNumber(a.currentBalance), 0) : null,
    attention: attention.filter((a) => a.count > 0),
    breakEven,
  };
}
