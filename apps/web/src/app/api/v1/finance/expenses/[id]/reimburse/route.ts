import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { serializeTransaction, transactionInclude } from "@/lib/finance-transactions";
import { notifyExpenseReimbursed } from "@/lib/push";
import { toNumber } from "@uln/shared";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;

    const existing = await prisma.financialTransaction.findFirst({
      where: { id, transactionType: "expense", deletedAt: null },
    });
    if (!existing) return jsonError("Expense not found", 404);
    if (!existing.isReimbursable) {
      return jsonError("Expense is not reimbursable", 400);
    }

    const expense = await prisma.financialTransaction.update({
      where: { id },
      data: {
        expenseStatus: "reimbursed",
        reimbursedAt: new Date(),
      },
      include: transactionInclude,
    });

    await logFinanceAudit("reimbursed", "expense", id, { user, request }, existing, expense);

    if (existing.fielderId) {
      await notifyExpenseReimbursed(existing.fielderId, toNumber(existing.amount));
    }

    return jsonOk(serializeTransaction(expense));
  } catch (error) {
    return handleApiError(error);
  }
}
