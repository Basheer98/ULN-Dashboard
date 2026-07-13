import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { serializeTransaction, transactionInclude } from "@/lib/finance-transactions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;

    const existing = await prisma.financialTransaction.findFirst({
      where: { id, transactionType: "expense" },
    });
    if (!existing) return jsonError("Expense not found", 404);
    if (!existing.deletedAt) return jsonError("Expense is not deleted", 400);

    const expense = await prisma.financialTransaction.update({
      where: { id },
      data: { deletedAt: null },
      include: transactionInclude,
    });

    await logFinanceAudit("restored", "expense", id, { user, request }, existing, expense);

    return jsonOk(serializeTransaction(expense));
  } catch (error) {
    return handleApiError(error);
  }
}
