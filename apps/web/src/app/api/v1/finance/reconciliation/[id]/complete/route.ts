import { NextRequest } from "next/server";
import { toNumber } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;

    const existing = await prisma.bankReconciliation.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) return jsonError("Reconciliation not found", 404);
    if (existing.status === "completed") {
      return jsonError("Reconciliation already completed", 400);
    }

    const difference = toNumber(existing.difference);
    if (difference !== 0) {
      return jsonError(`Reconciliation is not balanced. Difference: ${difference}`, 400);
    }

    const reconciliation = await prisma.bankReconciliation.update({
      where: { id },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
      include: { paymentMethod: true, items: true },
    });

    await logFinanceAudit(
      "reconciled",
      "reconciliation",
      id,
      { user, request },
      existing,
      reconciliation
    );

    return jsonOk(reconciliation);
  } catch (error) {
    return handleApiError(error);
  }
}
