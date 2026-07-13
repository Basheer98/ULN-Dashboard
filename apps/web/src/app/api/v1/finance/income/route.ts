import { NextRequest } from "next/server";
import type { Prisma } from "@uln/database";
import { incomeSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead, requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import {
  generateTransactionNumber,
  serializeTransaction,
  transactionInclude,
} from "@/lib/finance-transactions";

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const { searchParams } = request.nextUrl;

    const where: Prisma.FinancialTransactionWhereInput = {
      transactionType: "income",
      deletedAt: searchParams.get("includeDeleted") === "true" ? undefined : null,
    };

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      where.transactionDate = {};
      if (from) where.transactionDate.gte = new Date(from);
      if (to) where.transactionDate.lte = new Date(to);
    }

    const clientId = searchParams.get("clientId");
    if (clientId) where.clientId = clientId;

    const income = await prisma.financialTransaction.findMany({
      where,
      orderBy: { transactionDate: "desc" },
      include: transactionInclude,
    });

    return jsonOk(income.map(serializeTransaction));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const body = await request.json();
    const parsed = incomeSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const transactionNumber = await generateTransactionNumber();
    const tx = await prisma.financialTransaction.create({
      data: {
        transactionNumber,
        transactionType: "income",
        transactionDate: new Date(parsed.data.transactionDate),
        amount: parsed.data.amount,
        description: parsed.data.description,
        incomeCategory: parsed.data.incomeCategory,
        clientId: parsed.data.clientId ?? null,
        invoiceId: parsed.data.invoiceId ?? null,
        projectId: parsed.data.projectId ?? null,
        paymentMethodId: parsed.data.paymentMethodId ?? null,
        paymentReference: parsed.data.paymentReference,
        notes: parsed.data.notes,
        createdById: user.id,
      },
      include: transactionInclude,
    });

    const serialized = serializeTransaction(tx);
    await logFinanceAudit("created", "income", tx.id, { user, request }, undefined, serialized);

    return jsonOk(serialized, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
