import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { serializeTransaction, transactionInclude } from "@/lib/finance-transactions";
import { notifyExpenseRejected } from "@/lib/push";
import { toNumber } from "@uln/shared";

const rejectSchema = z.object({ reason: z.string().min(1) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;
    const body = await request.json();
    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) return jsonError("Rejection reason required", 400);

    const existing = await prisma.financialTransaction.findFirst({
      where: { id, transactionType: "expense", deletedAt: null },
    });
    if (!existing) return jsonError("Expense not found", 404);

    const expense = await prisma.financialTransaction.update({
      where: { id },
      data: {
        expenseStatus: "rejected",
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewReason: parsed.data.reason,
      },
      include: transactionInclude,
    });

    await logFinanceAudit("rejected", "expense", id, { user, request }, existing, expense);

    if (existing.fielderId) {
      await notifyExpenseRejected(existing.fielderId, toNumber(existing.amount));
    }

    return jsonOk(serializeTransaction(expense));
  } catch (error) {
    return handleApiError(error);
  }
}
