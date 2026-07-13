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

export { transactionInclude };
