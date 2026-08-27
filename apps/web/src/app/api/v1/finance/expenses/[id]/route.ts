import { NextRequest } from "next/server";
import { expenseSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  assertCanViewTransaction,
  requireAuthUser,
  requireFinanceWrite,
} from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { serializeTransaction, transactionInclude } from "@/lib/finance-transactions";
import { updateExpenseTransaction } from "@/lib/finance-expense";

async function getExpense(id: string) {
  return prisma.financialTransaction.findFirst({
    where: { id, transactionType: "expense" },
    include: transactionInclude,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuthUser(await getRequestUser(request));
    const { id } = await params;

    const expense = await getExpense(id);
    if (!expense || expense.deletedAt) return jsonError("Expense not found", 404);
    assertCanViewTransaction(user, expense.fielderId);

    return jsonOk(serializeTransaction(expense));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;
    const body = await request.json();
    const parsed = expenseSchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const existing = await getExpense(id);
    if (!existing || existing.deletedAt) return jsonError("Expense not found", 404);

    const expense = await updateExpenseTransaction(id, parsed.data);

    await logFinanceAudit("updated", "expense", id, { user, request }, existing, expense);

    return jsonOk(expense);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;

    const existing = await getExpense(id);
    if (!existing || existing.deletedAt) return jsonError("Expense not found", 404);

    const expense = await prisma.financialTransaction.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: transactionInclude,
    });

    await logFinanceAudit("deleted", "expense", id, { user, request }, existing, expense);

    return jsonOk(serializeTransaction(expense));
  } catch (error) {
    return handleApiError(error);
  }
}
