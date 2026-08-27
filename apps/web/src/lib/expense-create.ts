import type { ExpenseInput } from "@uln/shared";
import type { SessionUser } from "./auth";
import { createExpenseTransaction } from "./finance-expense";
import { suggestExpenseFields, validateExpenseSubmission } from "./expense-smart-service";

export async function prepareExpenseCreate(
  data: ExpenseInput,
  user: SessionUser,
  options: {
    forceFielderId?: string;
    defaultStatus?: string;
  }
) {
  const fielderId = options.forceFielderId ?? data.fielderId ?? null;
  const targetStatus = data.expenseStatus ?? options.defaultStatus ?? "draft";

  const validation = await validateExpenseSubmission(data, {
    fielderId,
    expenseStatus: targetStatus,
  });

  if (validation.blocked) {
    return {
      ok: false as const,
      error: validation.blockReason ?? "Expense policy violation",
      validation,
    };
  }

  let categoryId = data.categoryId ?? null;
  let vendorId = data.vendorId ?? null;

  if (!categoryId) {
    const suggestions = await suggestExpenseFields({
      description: data.description,
      vendorName: null,
      vendorId: data.vendorId,
      fielderId,
      amount: data.amount,
      transactionDate: data.transactionDate,
    });
    categoryId = suggestions.categorySuggestion.categoryId ?? categoryId;
    vendorId = vendorId ?? suggestions.categorySuggestion.vendorId ?? null;
  }

  const resolvedStatus = validation.resolvedStatus as ExpenseInput["expenseStatus"];

  const expense = await createExpenseTransaction(
    {
      ...data,
      categoryId,
      vendorId,
      expenseStatus: resolvedStatus,
    },
    user,
    {
      forceFielderId: options.forceFielderId,
      defaultStatus: resolvedStatus,
      reviewReason: validation.reviewReason,
    }
  );

  return {
    ok: true as const,
    expense,
    validation,
  };
}
