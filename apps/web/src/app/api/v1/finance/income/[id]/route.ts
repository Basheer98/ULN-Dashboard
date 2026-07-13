import { NextRequest } from "next/server";
import { incomeSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead, requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { serializeTransaction, transactionInclude } from "@/lib/finance-transactions";

async function getIncome(id: string) {
  return prisma.financialTransaction.findFirst({
    where: { id, transactionType: "income" },
    include: transactionInclude,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const { id } = await params;

    const income = await getIncome(id);
    if (!income || income.deletedAt) return jsonError("Income not found", 404);

    return jsonOk(serializeTransaction(income));
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
    const parsed = incomeSchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const existing = await getIncome(id);
    if (!existing || existing.deletedAt) return jsonError("Income not found", 404);

    const income = await prisma.financialTransaction.update({
      where: { id },
      data: {
        ...(parsed.data.transactionDate
          ? { transactionDate: new Date(parsed.data.transactionDate) }
          : {}),
        ...(parsed.data.amount !== undefined ? { amount: parsed.data.amount } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.incomeCategory !== undefined
          ? { incomeCategory: parsed.data.incomeCategory }
          : {}),
        ...(parsed.data.clientId !== undefined ? { clientId: parsed.data.clientId } : {}),
        ...(parsed.data.invoiceId !== undefined ? { invoiceId: parsed.data.invoiceId } : {}),
        ...(parsed.data.projectId !== undefined ? { projectId: parsed.data.projectId } : {}),
        ...(parsed.data.paymentMethodId !== undefined
          ? { paymentMethodId: parsed.data.paymentMethodId }
          : {}),
        ...(parsed.data.paymentReference !== undefined
          ? { paymentReference: parsed.data.paymentReference }
          : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      },
      include: transactionInclude,
    });

    const serialized = serializeTransaction(income);
    await logFinanceAudit("updated", "income", id, { user, request }, existing, serialized);

    return jsonOk(serialized);
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

    const existing = await getIncome(id);
    if (!existing || existing.deletedAt) return jsonError("Income not found", 404);

    const income = await prisma.financialTransaction.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: transactionInclude,
    });

    const serialized = serializeTransaction(income);
    await logFinanceAudit("deleted", "income", id, { user, request }, existing, serialized);

    return jsonOk(serialized);
  } catch (error) {
    return handleApiError(error);
  }
}
