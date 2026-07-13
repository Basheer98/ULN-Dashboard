import { NextRequest } from "next/server";
import { paymentMethodSchema, toNumber } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead, requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

function serializePaymentMethod(method: {
  openingBalance: unknown;
  currentBalance: unknown;
  [key: string]: unknown;
}) {
  return {
    ...method,
    openingBalance: toNumber(method.openingBalance),
    currentBalance: toNumber(method.currentBalance),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const { id } = await params;

    const method = await prisma.paymentMethod.findUnique({ where: { id } });
    if (!method) return jsonError("Payment method not found", 404);

    return jsonOk(serializePaymentMethod(method));
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
    const parsed = paymentMethodSchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const existing = await prisma.paymentMethod.findUnique({ where: { id } });
    if (!existing) return jsonError("Payment method not found", 404);

    const method = await prisma.paymentMethod.update({
      where: { id },
      data: parsed.data,
    });

    await logFinanceAudit("updated", "payment_method", id, { user, request }, existing, method);

    return jsonOk(serializePaymentMethod(method));
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

    const existing = await prisma.paymentMethod.findUnique({ where: { id } });
    if (!existing) return jsonError("Payment method not found", 404);

    const method = await prisma.paymentMethod.update({
      where: { id },
      data: { isActive: false },
    });

    await logFinanceAudit("deleted", "payment_method", id, { user, request }, existing, method);

    return jsonOk(serializePaymentMethod(method));
  } catch (error) {
    return handleApiError(error);
  }
}
