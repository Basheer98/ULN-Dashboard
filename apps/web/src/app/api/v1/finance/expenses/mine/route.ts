import { NextRequest } from "next/server";
import { expenseSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFielderSelf } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { serializeTransaction, transactionInclude } from "@/lib/finance-transactions";
import { createExpenseTransaction } from "@/lib/finance-expense";
import { notifyOfficeExpenseSubmitted } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  try {
    const user = requireFielderSelf(await getRequestUser(request));

    const expenses = await prisma.financialTransaction.findMany({
      where: {
        transactionType: "expense",
        fielderId: user.fielderId!,
        deletedAt: null,
      },
      orderBy: { transactionDate: "desc" },
      include: transactionInclude,
    });

    return jsonOk(expenses.map(serializeTransaction));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireFielderSelf(await getRequestUser(request));
    const body = await request.json();
    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const expense = await createExpenseTransaction(parsed.data, user, {
      forceFielderId: user.fielderId!,
      defaultStatus: "submitted",
    });

    await logFinanceAudit("created", "expense", expense.id, { user, request }, undefined, expense);

    const fielder = await prisma.fielder.findUnique({ where: { id: user.fielderId! } });
    if (fielder) {
      await notifyOfficeExpenseSubmitted(
        `${fielder.firstName} ${fielder.lastName}`,
        Number(expense.amount),
        expense.id,
        expense.transactionNumber
      );
    }

    return jsonOk(expense, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
