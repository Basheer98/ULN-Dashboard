import { NextRequest } from "next/server";
import { reconciliationSchema, toNumber, calculateReconciliationDifference } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead, requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

function serializeReconciliation(rec: {
  startingBalance: unknown;
  endingBalance: unknown;
  clearedTotal: unknown;
  difference: unknown;
  [key: string]: unknown;
}) {
  return {
    ...rec,
    startingBalance: toNumber(rec.startingBalance),
    endingBalance: toNumber(rec.endingBalance),
    clearedTotal: toNumber(rec.clearedTotal),
    difference: toNumber(rec.difference),
  };
}

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const paymentMethodId = request.nextUrl.searchParams.get("paymentMethodId");

    const reconciliations = await prisma.bankReconciliation.findMany({
      where: paymentMethodId ? { paymentMethodId } : undefined,
      orderBy: { statementDate: "desc" },
      include: { paymentMethod: true, items: true },
    });

    return jsonOk(reconciliations.map(serializeReconciliation));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const body = await request.json();
    const parsed = reconciliationSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const reconciliation = await prisma.bankReconciliation.create({
      data: {
        paymentMethodId: parsed.data.paymentMethodId,
        statementDate: new Date(parsed.data.statementDate),
        startingBalance: parsed.data.startingBalance,
        endingBalance: parsed.data.endingBalance,
        difference: calculateReconciliationDifference(
          parsed.data.startingBalance,
          0,
          parsed.data.endingBalance
        ),
        notes: parsed.data.notes,
      },
      include: { paymentMethod: true, items: true },
    });

    await logFinanceAudit(
      "created",
      "reconciliation",
      reconciliation.id,
      { user, request },
      undefined,
      reconciliation
    );

    return jsonOk(serializeReconciliation(reconciliation), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
