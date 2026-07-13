import { NextRequest } from "next/server";
import type { Prisma } from "@uln/database";
import { expenseSchema, hasPermission } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  requireFinanceRead,
  requireFinanceWrite,
  requireFielderSelf,
} from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { serializeTransaction, transactionInclude } from "@/lib/finance-transactions";
import { createExpenseTransaction } from "@/lib/finance-expense";

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const { searchParams } = request.nextUrl;

    const where: Prisma.FinancialTransactionWhereInput = {
      transactionType: "expense",
      deletedAt: searchParams.get("includeDeleted") === "true" ? undefined : null,
    };

    const status = searchParams.get("status");
    if (status) where.expenseStatus = status as never;

    const categoryId = searchParams.get("category");
    if (categoryId) where.categoryId = categoryId;

    const fielderId = searchParams.get("fielderId");
    if (fielderId) where.fielderId = fielderId;

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      where.transactionDate = {};
      if (from) where.transactionDate.gte = new Date(from);
      if (to) where.transactionDate.lte = new Date(to);
    }

    const expenses = await prisma.financialTransaction.findMany({
      where,
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
    const user = await getRequestUser(request);
    if (!user) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const parsed = expenseSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const isFielder = user.role === "fielder" && user.fielderId;
    if (isFielder) {
      requireFielderSelf(user);
      if (!hasPermission(user.role, "expense:self:create")) {
        return jsonError("Forbidden", 403);
      }
    } else {
      requireFinanceWrite(user);
    }

    const expense = await createExpenseTransaction(parsed.data, user, {
      forceFielderId: isFielder ? user.fielderId! : undefined,
      defaultStatus: isFielder ? "submitted" : parsed.data.expenseStatus ?? "draft",
    });

    await logFinanceAudit("created", "expense", expense.id, { user, request }, undefined, expense);

    return jsonOk(expense, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
