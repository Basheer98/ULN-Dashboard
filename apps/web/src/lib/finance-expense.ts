import type { ExpenseInput } from "@uln/shared";
import type { SessionUser } from "./auth";
import { prisma } from "./prisma";
import { generateTransactionNumber, transactionInclude, serializeTransaction } from "./finance-transactions";
import { linkReceiptToExpense } from "./expense-smart-service";

export async function createExpenseTransaction(
  data: ExpenseInput,
  user: SessionUser,
  options?: {
    forceFielderId?: string;
    defaultStatus?: string;
    reviewReason?: string | null;
  }
) {
  const transactionNumber = await generateTransactionNumber();
  const fielderId = options?.forceFielderId ?? data.fielderId ?? null;
  const expenseStatus = (data.expenseStatus ?? options?.defaultStatus ?? "draft") as never;

  const tx = await prisma.financialTransaction.create({
    data: {
      transactionNumber,
      transactionType: "expense",
      transactionDate: new Date(data.transactionDate),
      amount: data.amount,
      description: data.description,
      businessPurpose: data.businessPurpose,
      categoryId: data.categoryId ?? null,
      subcategoryId: data.subcategoryId ?? null,
      paymentMethodId: data.paymentMethodId ?? null,
      projectId: data.projectId ?? null,
      fielderId,
      vendorId: data.vendorId ?? null,
      tripId: data.tripId ?? null,
      paidBy: data.paidBy,
      cardLastFour: data.cardLastFour,
      isReimbursable: data.isReimbursable ?? false,
      isBillable: data.isBillable ?? false,
      isTaxDeductible: data.isTaxDeductible ?? true,
      paymentReference: data.paymentReference,
      notes: data.notes,
      expenseStatus,
      reviewReason: options?.reviewReason ?? null,
      submittedById: fielderId ? user.id : null,
      createdById: user.id,
      allocations: data.allocations?.length
        ? {
            create: data.allocations.map((a) => ({
              projectId: a.projectId,
              amount: a.amount,
              percent: a.percent ?? null,
            })),
          }
        : undefined,
    },
    include: transactionInclude,
  });

  if (data.receiptId) {
    await linkReceiptToExpense(data.receiptId, tx.id, data.projectId ?? null);
  }

  const refreshed = await prisma.financialTransaction.findUniqueOrThrow({
    where: { id: tx.id },
    include: transactionInclude,
  });

  return serializeTransaction(refreshed);
}

export async function updateExpenseTransaction(id: string, data: Partial<ExpenseInput>) {
  if (data.allocations) {
    await prisma.expenseAllocation.deleteMany({ where: { transactionId: id } });
  }

  const tx = await prisma.financialTransaction.update({
    where: { id },
    data: {
      ...(data.transactionDate ? { transactionDate: new Date(data.transactionDate) } : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.businessPurpose !== undefined ? { businessPurpose: data.businessPurpose } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.subcategoryId !== undefined ? { subcategoryId: data.subcategoryId } : {}),
      ...(data.paymentMethodId !== undefined ? { paymentMethodId: data.paymentMethodId } : {}),
      ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
      ...(data.fielderId !== undefined ? { fielderId: data.fielderId } : {}),
      ...(data.vendorId !== undefined ? { vendorId: data.vendorId } : {}),
      ...(data.tripId !== undefined ? { tripId: data.tripId } : {}),
      ...(data.paidBy !== undefined ? { paidBy: data.paidBy } : {}),
      ...(data.cardLastFour !== undefined ? { cardLastFour: data.cardLastFour } : {}),
      ...(data.isReimbursable !== undefined ? { isReimbursable: data.isReimbursable } : {}),
      ...(data.isBillable !== undefined ? { isBillable: data.isBillable } : {}),
      ...(data.isTaxDeductible !== undefined ? { isTaxDeductible: data.isTaxDeductible } : {}),
      ...(data.paymentReference !== undefined ? { paymentReference: data.paymentReference } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.expenseStatus !== undefined ? { expenseStatus: data.expenseStatus as never } : {}),
      ...(data.allocations
        ? {
            allocations: {
              create: data.allocations.map((a) => ({
                projectId: a.projectId,
                amount: a.amount,
                percent: a.percent ?? null,
              })),
            },
          }
        : {}),
    },
    include: transactionInclude,
  });

  return serializeTransaction(tx);
}
