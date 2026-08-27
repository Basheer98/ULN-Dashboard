import {
  DEFAULT_FINANCE_SETTINGS,
  FINANCE_SETTING_KEYS,
  evaluateExpensePolicy,
  findDuplicateExpenses,
  parseFinanceThreshold,
  suggestCategory,
  type CategoryOption,
  type ExistingExpense,
  type ExpenseDuplicateMatch,
  type ExpensePolicyResult,
  type CategorySuggestion,
} from "@uln/shared";
import type { ExpenseInput } from "@uln/shared";
import { prisma } from "./prisma";
import { getFinanceSetting } from "./finance-settings";

export async function getExpensePolicyThresholds() {
  const [receiptRequiredAbove, expenseReviewAbove] = await Promise.all([
    getFinanceSetting(FINANCE_SETTING_KEYS.receiptRequiredAbove),
    getFinanceSetting(FINANCE_SETTING_KEYS.expenseReviewAbove),
  ]);

  return {
    receiptRequiredAbove: parseFinanceThreshold(
      receiptRequiredAbove,
      parseFinanceThreshold(DEFAULT_FINANCE_SETTINGS[FINANCE_SETTING_KEYS.receiptRequiredAbove]!, 25)
    ),
    expenseReviewAbove: parseFinanceThreshold(
      expenseReviewAbove,
      parseFinanceThreshold(DEFAULT_FINANCE_SETTINGS[FINANCE_SETTING_KEYS.expenseReviewAbove]!, 200)
    ),
  };
}

export async function receiptExists(receiptId: string | null | undefined): Promise<boolean> {
  if (!receiptId) return false;
  const receipt = await prisma.receipt.findFirst({
    where: { id: receiptId, deletedAt: null },
    select: { id: true },
  });
  return Boolean(receipt);
}

export async function linkReceiptToExpense(receiptId: string, transactionId: string, projectId?: string | null) {
  await prisma.receipt.update({
    where: { id: receiptId },
    data: {
      transactionId,
      ...(projectId ? { projectId } : {}),
    },
  });
}

export async function loadFielderExpenseHistory(fielderId: string | null, limit = 20) {
  if (!fielderId) return [];
  return prisma.financialTransaction.findMany({
    where: {
      transactionType: "expense",
      fielderId,
      deletedAt: null,
    },
    orderBy: { transactionDate: "desc" },
    take: limit,
    select: {
      categoryId: true,
      description: true,
      vendorId: true,
    },
  });
}

export async function loadDuplicateCandidates(fielderId: string | null, transactionDate: string) {
  const date = new Date(transactionDate);
  const from = new Date(date);
  from.setDate(from.getDate() - 2);
  const to = new Date(date);
  to.setDate(to.getDate() + 2);

  const rows = await prisma.financialTransaction.findMany({
    where: {
      transactionType: "expense",
      deletedAt: null,
      fielderId: fielderId ?? undefined,
      transactionDate: { gte: from, lte: to },
    },
    select: {
      id: true,
      transactionNumber: true,
      amount: true,
      transactionDate: true,
      description: true,
      fielderId: true,
    },
  });

  return rows.map(
    (row): ExistingExpense => ({
      id: row.id,
      transactionNumber: row.transactionNumber,
      amount: Number(row.amount),
      transactionDate: row.transactionDate.toISOString(),
      description: row.description,
      fielderId: row.fielderId,
    })
  );
}

export async function suggestExpenseFields(input: {
  description?: string | null;
  vendorName?: string | null;
  vendorId?: string | null;
  fielderId?: string | null;
  amount?: number;
  transactionDate?: string;
  excludeExpenseId?: string;
}) {
  const [categories, vendors, history, duplicateCandidates] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.vendor.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, defaultCategoryId: true },
    }),
    loadFielderExpenseHistory(input.fielderId ?? null),
    input.amount && input.transactionDate
      ? loadDuplicateCandidates(input.fielderId ?? null, input.transactionDate)
      : Promise.resolve([]),
  ]);

  const categorySuggestion: CategorySuggestion = suggestCategory({
    description: input.description,
    vendorName: input.vendorName,
    vendorId: input.vendorId,
    categories: categories as CategoryOption[],
    vendors,
    history,
  });

  const duplicates: ExpenseDuplicateMatch[] =
    input.amount && input.transactionDate
      ? findDuplicateExpenses(
          {
            amount: input.amount,
            transactionDate: input.transactionDate,
            fielderId: input.fielderId ?? null,
          },
          duplicateCandidates,
          input.excludeExpenseId
        )
      : [];

  return { categorySuggestion, duplicates };
}

export async function validateExpenseSubmission(
  data: ExpenseInput,
  options: {
    fielderId: string | null;
    expenseStatus: string;
    excludeExpenseId?: string;
  }
): Promise<ExpensePolicyResult & { duplicates: ExpenseDuplicateMatch[] }> {
  const thresholds = await getExpensePolicyThresholds();
  const hasReceipt = await receiptExists(data.receiptId);

  const duplicates =
    data.amount && data.transactionDate
      ? findDuplicateExpenses(
          {
            amount: data.amount,
            transactionDate: data.transactionDate,
            fielderId: options.fielderId,
          },
          await loadDuplicateCandidates(options.fielderId, data.transactionDate),
          options.excludeExpenseId
        )
      : [];

  const policy = evaluateExpensePolicy({
    amount: data.amount,
    expenseStatus: options.expenseStatus,
    hasReceipt,
    receiptRequiredAbove: thresholds.receiptRequiredAbove,
    expenseReviewAbove: thresholds.expenseReviewAbove,
    duplicateCount: duplicates.length,
    acknowledgeDuplicate: data.acknowledgeDuplicate,
  });

  return { ...policy, duplicates };
}
