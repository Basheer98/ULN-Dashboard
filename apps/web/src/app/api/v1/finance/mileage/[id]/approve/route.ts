import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { notifyFielderById } from "@/lib/push";
import { toNumber } from "@uln/shared";

function serializeMileage(entry: {
  totalMiles: unknown;
  mileageRate: unknown;
  reimbursement: unknown;
  [key: string]: unknown;
}) {
  return {
    ...entry,
    totalMiles: toNumber(entry.totalMiles),
    mileageRate: toNumber(entry.mileageRate),
    reimbursement: toNumber(entry.reimbursement),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;

    const existing = await prisma.mileageEntry.findUnique({ where: { id } });
    if (!existing) return jsonError("Mileage entry not found", 404);

    const entry = await prisma.mileageEntry.update({
      where: { id },
      data: { status: "approved" },
      include: { driver: true },
    });

    await logFinanceAudit("approved", "mileage", id, { user, request }, existing, entry);

    await notifyFielderById(
      entry.driverId,
      "Mileage Approved",
      `Your ${toNumber(entry.totalMiles).toFixed(1)} mile entry was approved ($${toNumber(entry.reimbursement).toFixed(2)}).`,
      { type: "mileage_approved" }
    );

    return jsonOk(serializeMileage(entry));
  } catch (error) {
    return handleApiError(error);
  }
}
