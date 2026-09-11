import { prisma } from "./prisma";
import { toNumber, calculateInvoiceBalance, sumDecimal } from "@uln/shared";
import type { Prisma } from "@uln/database";

export async function generateTransactionNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TXN-${year}-`;
  const latest = await prisma.financialTransaction.findFirst({
    where: { transactionNumber: { startsWith: prefix } },
    orderBy: { transactionNumber: "desc" },
  });
  if (!latest) return `${prefix}0001`;
  const lastNum = parseInt(latest.transactionNumber.replace(prefix, ""), 10);
  return `${prefix}${(lastNum + 1).toString().padStart(4, "0")}`;
}

const transactionInclude = {
  category: true,
  subcategory: true,
  paymentMethod: true,
  project: true,
  fielder: true,
  client: true,
  vendor: true,
  trip: true,
  createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
  reviewedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
  allocations: { include: { project: true } },
  receipts: { where: { deletedAt: null } },
  invoicePayments: { include: { invoice: true } },
} satisfies Prisma.FinancialTransactionInclude;

export function serializeTransaction(tx: Prisma.FinancialTransactionGetPayload<{ include: typeof transactionInclude }>) {
  return {
    ...tx,
    amount: toNumber(tx.amount),
    allocations: tx.allocations.map((a) => ({
      ...a,
      amount: toNumber(a.amount),
      percent: a.percent ? toNumber(a.percent) : null,
    })),
    invoicePayments: tx.invoicePayments.map((p) => ({
      ...p,
      amount: toNumber(p.amount),
    })),
  };
}

export async function getFinanceDashboardStats(startDate?: Date, endDate?: Date) {
  const dateFilter =
    startDate && endDate
      ? { transactionDate: { gte: startDate, lte: endDate } }
      : {};

  const transactions = await prisma.financialTransaction.findMany({
    where: { deletedAt: null, ...dateFilter },
    include: { category: true, allocations: true },
  });

  const income = sumDecimal(
    transactions
      .filter((t) => t.transactionType === "income")
      .map((t) => toNumber(t.amount))
  );
  const expenses = sumDecimal(
    transactions
      .filter((t) => t.transactionType === "expense")
      .map((t) => toNumber(t.amount))
  );
  const ownerDraws = sumDecimal(
    transactions
      .filter((t) => t.transactionType === "owner_draw")
      .map((t) => toNumber(t.amount))
  );

  const pendingReimbursements = await prisma.financialTransaction.count({
    where: {
      deletedAt: null,
      transactionType: "expense",
      isReimbursable: true,
      expenseStatus: { in: ["submitted", "pending_review", "approved"] },
    },
  });

  const outstandingInvoices = await prisma.invoice.findMany({
    where: { status: { in: ["sent", "partial", "overdue"] } },
    include: { invoicePayments: { include: { transaction: true } } },
  });

  const outstandingTotal = sumDecimal(
    outstandingInvoices.map((inv) => {
      const { remaining } = calculateInvoiceBalance(
        toNumber(inv.totalAmount),
        inv.invoicePayments.map((p) => ({ amount: toNumber(p.amount) }))
      );
      return remaining;
    })
  );

  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { isActive: true, includeInDashboard: true },
  });

  const expensesByCategory = transactions
    .filter((t) => t.transactionType === "expense" && t.category)
    .reduce<Record<string, number>>((acc, t) => {
      const name = t.category!.name;
      acc[name] = (acc[name] ?? 0) + toNumber(t.amount);
      return acc;
    }, {});

  return {
    income,
    expenses,
    netIncome: income - expenses,
    ownerDraws,
    pendingReimbursements,
    outstandingInvoices: outstandingTotal,
    cashOnHand: sumDecimal(paymentMethods.map((m) => toNumber(m.currentBalance))),
    expensesByCategory: Object.entries(expensesByCategory).map(([name, amount]) => ({
      name,
      amount,
    })),
  };
}

export async function getProjectProfitability(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      client: true,
      invoices: { include: { invoicePayments: true } },
      financeTransactions: { where: { deletedAt: null, transactionType: "expense" } },
      expenseAllocations: { include: { transaction: true } },
    },
  });

  const revenue = sumDecimal(
    project.invoices.flatMap((inv) =>
      inv.invoicePayments.map((p) => toNumber(p.amount))
    )
  );
  const directExpenses = sumDecimal(
    project.financeTransactions.map((t) => toNumber(t.amount))
  );
  const allocatedExpenses = sumDecimal(
    project.expenseAllocations
      .filter((a) => !a.transaction.deletedAt)
      .map((a) => toNumber(a.amount))
  );
  const totalExpenses = directExpenses + allocatedExpenses;
  const profit = revenue - totalExpenses;

  return {
    project,
    revenue,
    directExpenses,
    allocatedExpenses,
    totalExpenses,
    profit,
    margin: revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0,
  };
}

export type StateProfitCategory = {
  key: string;
  label: string;
  amount: number;
};

export type StateProfitRow = {
  state: string;
  stateLabel: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  projectCount: number;
  expenseCount: number;
  categories: StateProfitCategory[];
};

/** Effective work state: expense.workState, else linked project.state. */
export function effectiveExpenseState(expense: {
  workState?: string | null;
  project?: { state?: string | null } | null;
}): string | null {
  const raw = expense.workState || expense.project?.state || null;
  if (!raw) return null;
  return raw.trim().toUpperCase() || null;
}

export async function getStateProfitability(options?: {
  from?: Date;
  to?: Date;
}): Promise<StateProfitRow[]> {
  const { stateName } = await import("@uln/shared");
  const dateFilter =
    options?.from || options?.to
      ? {
          ...(options.from ? { gte: options.from } : {}),
          ...(options.to ? { lte: options.to } : {}),
        }
      : undefined;

  const [projects, expenses] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: null, state: { not: null } },
      include: {
        invoices: {
          include: {
            invoicePayments: {
              ...(dateFilter ? { where: { paidAt: dateFilter } } : {}),
            },
          },
        },
      },
    }),
    prisma.financialTransaction.findMany({
      where: {
        deletedAt: null,
        transactionType: "expense",
        ...(dateFilter ? { transactionDate: dateFilter } : {}),
      },
      include: {
        category: true,
        subcategory: true,
        project: { select: { state: true } },
      },
    }),
  ]);

  const byState = new Map<
    string,
    {
      revenue: number;
      expenses: number;
      projectIds: Set<string>;
      expenseCount: number;
      categories: Map<string, { label: string; amount: number }>;
    }
  >();

  function bucket(state: string) {
    let row = byState.get(state);
    if (!row) {
      row = {
        revenue: 0,
        expenses: 0,
        projectIds: new Set(),
        expenseCount: 0,
        categories: new Map(),
      };
      byState.set(state, row);
    }
    return row;
  }

  for (const project of projects) {
    const state = project.state?.trim().toUpperCase();
    if (!state) continue;
    const row = bucket(state);
    row.projectIds.add(project.id);
    row.revenue += sumDecimal(
      project.invoices.flatMap((inv) => inv.invoicePayments.map((p) => toNumber(p.amount)))
    );
  }

  for (const expense of expenses) {
    const state = effectiveExpenseState(expense);
    if (!state) continue;
    const amount = toNumber(expense.amount);
    const row = bucket(state);
    row.expenses += amount;
    row.expenseCount += 1;

    const sub = expense.subcategory?.name;
    const cat = expense.category?.name;
    const key = sub ? `${cat ?? "Other"}:${sub}` : cat ?? "Uncategorized";
    const label = sub && cat ? `${cat} · ${sub}` : cat ?? "Uncategorized";
    const existing = row.categories.get(key) ?? { label, amount: 0 };
    existing.amount += amount;
    row.categories.set(key, existing);
  }

  return Array.from(byState.entries())
    .map(([state, row]) => {
      const profit = row.revenue - row.expenses;
      return {
        state,
        stateLabel: stateName(state),
        revenue: row.revenue,
        expenses: row.expenses,
        profit,
        margin: row.revenue > 0 ? Math.round((profit / row.revenue) * 10000) / 100 : 0,
        projectCount: row.projectIds.size,
        expenseCount: row.expenseCount,
        categories: Array.from(row.categories.values())
          .map((c) => ({ key: c.label, label: c.label, amount: c.amount }))
          .sort((a, b) => b.amount - a.amount),
      };
    })
    .sort((a, b) => b.expenses - a.expenses || a.state.localeCompare(b.state));
}

export { transactionInclude };
