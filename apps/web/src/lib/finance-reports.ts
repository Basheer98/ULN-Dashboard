import { prisma } from "./prisma";
import {
  toNumber,
  sumDecimal,
  calculateInvoiceBalance,
  parseDateRangeParams,
  type DateRange,
} from "@uln/shared";

export type FinanceReportType =
  | "pnl"
  | "cashflow"
  | "income-by-client"
  | "expenses-by-category"
  | "expenses-by-vendor"
  | "expenses-by-project"
  | "mileage"
  | "owner-draws"
  | "loans"
  | "outstanding-invoices"
  | "receipt-audit"
  | "tax-deductible"
  | "missing-receipts";

export const FINANCE_REPORT_TYPES: FinanceReportType[] = [
  "pnl",
  "cashflow",
  "income-by-client",
  "expenses-by-category",
  "expenses-by-vendor",
  "expenses-by-project",
  "mileage",
  "owner-draws",
  "loans",
  "outstanding-invoices",
  "receipt-audit",
  "tax-deductible",
  "missing-receipts",
];

export async function generateFinanceReport(type: FinanceReportType, range: DateRange) {
  switch (type) {
    case "pnl": {
      const transactions = await prisma.financialTransaction.findMany({
        where: { deletedAt: null, transactionDate: { gte: range.from, lte: range.to } },
      });
      const income = sumDecimal(
        transactions.filter((t) => t.transactionType === "income").map((t) => toNumber(t.amount))
      );
      const expenses = sumDecimal(
        transactions.filter((t) => t.transactionType === "expense").map((t) => toNumber(t.amount))
      );
      return { income, expenses, netIncome: income - expenses, range };
    }
    case "cashflow": {
      const transactions = await prisma.financialTransaction.findMany({
        where: { deletedAt: null, transactionDate: { gte: range.from, lte: range.to } },
        orderBy: { transactionDate: "asc" },
      });
      let balance = 0;
      const entries = transactions.map((t) => {
        const amount = toNumber(t.amount);
        const inflow = ["income", "owner_contribution", "loan_proceeds"].includes(t.transactionType);
        const delta = inflow ? amount : -amount;
        balance += delta;
        return {
          date: t.transactionDate,
          type: t.transactionType,
          description: t.description,
          amount,
          delta,
          balance: Math.round(balance * 100) / 100,
        };
      });
      return { entries, range };
    }
    case "income-by-client": {
      const transactions = await prisma.financialTransaction.findMany({
        where: {
          deletedAt: null,
          transactionType: "income",
          transactionDate: { gte: range.from, lte: range.to },
        },
        include: { client: true },
      });
      const byClient = transactions.reduce<Record<string, { name: string; amount: number }>>((acc, t) => {
        const key = t.clientId ?? "unknown";
        const name = t.client?.name ?? "Unknown";
        if (!acc[key]) acc[key] = { name, amount: 0 };
        acc[key].amount += toNumber(t.amount);
        return acc;
      }, {});
      return { rows: Object.values(byClient), range };
    }
    case "expenses-by-category": {
      const transactions = await prisma.financialTransaction.findMany({
        where: {
          deletedAt: null,
          transactionType: "expense",
          transactionDate: { gte: range.from, lte: range.to },
        },
        include: { category: true },
      });
      const byCategory = transactions.reduce<Record<string, { name: string; amount: number }>>((acc, t) => {
        const key = t.categoryId ?? "uncategorized";
        const name = t.category?.name ?? "Uncategorized";
        if (!acc[key]) acc[key] = { name, amount: 0 };
        acc[key].amount += toNumber(t.amount);
        return acc;
      }, {});
      return { rows: Object.values(byCategory), range };
    }
    case "expenses-by-vendor": {
      const transactions = await prisma.financialTransaction.findMany({
        where: {
          deletedAt: null,
          transactionType: "expense",
          transactionDate: { gte: range.from, lte: range.to },
        },
        include: { vendor: true },
      });
      const byVendor = transactions.reduce<Record<string, { name: string; amount: number }>>((acc, t) => {
        const key = t.vendorId ?? "unknown";
        const name = t.vendor?.name ?? "Unknown";
        if (!acc[key]) acc[key] = { name, amount: 0 };
        acc[key].amount += toNumber(t.amount);
        return acc;
      }, {});
      return { rows: Object.values(byVendor), range };
    }
    case "expenses-by-project": {
      const transactions = await prisma.financialTransaction.findMany({
        where: {
          deletedAt: null,
          transactionType: "expense",
          transactionDate: { gte: range.from, lte: range.to },
        },
        include: { project: true, allocations: { include: { project: true } } },
      });
      const byProject: Record<string, { name: string; amount: number }> = {};
      for (const t of transactions) {
        if (t.projectId && t.project) {
          const key = t.projectId;
          if (!byProject[key]) byProject[key] = { name: t.project.title, amount: 0 };
          byProject[key].amount += toNumber(t.amount);
        }
        for (const alloc of t.allocations) {
          const key = alloc.projectId;
          const name = alloc.project.title;
          if (!byProject[key]) byProject[key] = { name, amount: 0 };
          byProject[key].amount += toNumber(alloc.amount);
        }
      }
      return { rows: Object.values(byProject), range };
    }
    case "mileage": {
      const entries = await prisma.mileageEntry.findMany({
        where: { date: { gte: range.from, lte: range.to } },
        include: { driver: true, vehicle: true },
        orderBy: { date: "desc" },
      });
      return {
        rows: entries.map((e) => ({
          id: e.id,
          date: e.date,
          driver: `${e.driver.firstName} ${e.driver.lastName}`,
          vehicle: e.vehicle?.name ?? null,
          totalMiles: toNumber(e.totalMiles),
          reimbursement: toNumber(e.reimbursement),
          status: e.status,
        })),
        range,
      };
    }
    case "owner-draws": {
      const transactions = await prisma.financialTransaction.findMany({
        where: {
          deletedAt: null,
          transactionType: { in: ["owner_draw", "owner_contribution"] },
          transactionDate: { gte: range.from, lte: range.to },
        },
        orderBy: { transactionDate: "desc" },
      });
      return {
        rows: transactions.map((t) => ({
          id: t.id,
          date: t.transactionDate,
          type: t.transactionType,
          amount: toNumber(t.amount),
          description: t.description,
        })),
        range,
      };
    }
    case "loans": {
      const loans = await prisma.loan.findMany({
        include: { payments: true },
        orderBy: { createdAt: "desc" },
      });
      return {
        rows: loans.map((l) => ({
          id: l.id,
          lender: l.lender,
          originalAmount: toNumber(l.originalAmount),
          remainingBalance: toNumber(l.remainingBalance),
          status: l.status,
          paymentsCount: l.payments.length,
        })),
        range,
      };
    }
    case "outstanding-invoices": {
      const invoices = await prisma.invoice.findMany({
        where: { status: { in: ["sent", "partial", "overdue"] } },
        include: { client: true, project: true, invoicePayments: true },
        orderBy: { dueAt: "asc" },
      });
      return {
        rows: invoices.map((inv) => {
          const { paid, remaining } = calculateInvoiceBalance(
            toNumber(inv.totalAmount),
            inv.invoicePayments.map((p) => ({ amount: toNumber(p.amount) }))
          );
          return {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            client: inv.client.name,
            project: inv.project?.title ?? null,
            total: toNumber(inv.totalAmount),
            paid,
            remaining,
            status: inv.status,
            dueAt: inv.dueAt,
          };
        }),
        range,
      };
    }
    case "receipt-audit": {
      const receipts = await prisma.receipt.findMany({
        where: { deletedAt: null, createdAt: { gte: range.from, lte: range.to } },
        include: { uploadedBy: true, transaction: true },
        orderBy: { createdAt: "desc" },
      });
      return {
        rows: receipts.map((r) => ({
          id: r.id,
          fileName: r.originalFileName,
          status: r.verificationStatus,
          uploadedBy: r.uploadedBy?.email ?? null,
          transactionId: r.transactionId,
          createdAt: r.createdAt,
        })),
        range,
      };
    }
    case "tax-deductible": {
      const transactions = await prisma.financialTransaction.findMany({
        where: {
          deletedAt: null,
          transactionType: "expense",
          isTaxDeductible: true,
          transactionDate: { gte: range.from, lte: range.to },
        },
        include: { category: true, vendor: true },
        orderBy: { transactionDate: "desc" },
      });
      return {
        rows: transactions.map((t) => ({
          id: t.id,
          date: t.transactionDate,
          amount: toNumber(t.amount),
          description: t.description,
          category: t.category?.name ?? null,
          vendor: t.vendor?.name ?? null,
        })),
        total: sumDecimal(transactions.map((t) => toNumber(t.amount))),
        range,
      };
    }
    case "missing-receipts": {
      const receiptRequired = parseFloat(process.env.RECEIPT_REQUIRED_ABOVE ?? "25");
      const transactions = await prisma.financialTransaction.findMany({
        where: {
          deletedAt: null,
          transactionType: "expense",
          transactionDate: { gte: range.from, lte: range.to },
        },
        include: { receipts: { where: { deletedAt: null } }, fielder: true },
      });
      const missing = transactions.filter(
        (t) => toNumber(t.amount) >= receiptRequired && t.receipts.length === 0
      );
      return {
        rows: missing.map((t) => ({
          id: t.id,
          date: t.transactionDate,
          amount: toNumber(t.amount),
          description: t.description,
          fielder: t.fielder ? `${t.fielder.firstName} ${t.fielder.lastName}` : null,
          expenseStatus: t.expenseStatus,
        })),
        range,
      };
    }
    default:
      throw new Error(`Unknown report type: ${type}`);
  }
}

function escapeCsv(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function financeReportToCsv(type: FinanceReportType, data: unknown): string {
  const d = data as Record<string, unknown>;
  const rows = (d.rows as Record<string, unknown>[]) ?? [];

  if (type === "pnl") {
    return ["Metric,Amount", `Income,${d.income}`, `Expenses,${d.expenses}`, `Net Income,${d.netIncome}`].join("\n");
  }

  if (type === "cashflow") {
    const entries = (d.entries as Record<string, unknown>[]) ?? [];
    const header = "Date,Type,Description,Amount,Delta,Balance";
    const lines = entries.map(
      (e) =>
        [e.date, e.type, e.description, e.amount, e.delta, e.balance].map(escapeCsv).join(",")
    );
    return [header, ...lines].join("\n");
  }

  if (rows.length === 0) return "No data";

  const keys = Object.keys(rows[0]!);
  const header = keys.join(",");
  const lines = rows.map((row) => keys.map((k) => escapeCsv(row[k])).join(","));
  return [header, ...lines].join("\n");
}

export { parseDateRangeParams, type DateRange };
