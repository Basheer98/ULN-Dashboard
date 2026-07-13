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

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";

    const methods = await prisma.paymentMethod.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" },
    });

    return jsonOk(methods.map(serializePaymentMethod));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const body = await request.json();
    const parsed = paymentMethodSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const opening = parsed.data.openingBalance ?? 0;
    const method = await prisma.paymentMethod.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        accountNickname: parsed.data.accountNickname,
        lastFour: parsed.data.lastFour,
        openingBalance: opening,
        currentBalance: parsed.data.currentBalance ?? opening,
        includeInDashboard: parsed.data.includeInDashboard ?? true,
        isActive: parsed.data.isActive ?? true,
        notes: parsed.data.notes,
      },
    });

    await logFinanceAudit("created", "payment_method", method.id, { user, request }, undefined, method);

    return jsonOk(serializePaymentMethod(method), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
