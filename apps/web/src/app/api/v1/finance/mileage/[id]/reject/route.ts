import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { notifyFielderById } from "@/lib/push";
import { toNumber } from "@uln/shared";

const rejectSchema = z.object({ reason: z.string().min(1) });

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
    const body = await request.json();
    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) return jsonError("Reason required", 400);

    const existing = await prisma.mileageEntry.findUnique({ where: { id } });
    if (!existing) return jsonError("Mileage entry not found", 404);

    const entry = await prisma.mileageEntry.update({
      where: { id },
      data: { status: "rejected", notes: parsed.data.reason },
      include: { driver: true },
    });

    await logFinanceAudit("rejected", "mileage", id, { user, request }, existing, entry);

    await notifyFielderById(
      entry.driverId,
      "Mileage Rejected",
      `Your mileage entry was rejected: ${parsed.data.reason}`,
      { type: "mileage_rejected" }
    );

    return jsonOk(serializeMileage(entry));
  } catch (error) {
    return handleApiError(error);
  }
}
