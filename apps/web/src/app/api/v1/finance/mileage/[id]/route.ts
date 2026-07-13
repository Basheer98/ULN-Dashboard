import { NextRequest } from "next/server";
import { z } from "zod";
import { toNumber } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  canViewTransaction,
  requireFinanceRead,
  requireFinanceWrite,
} from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

const statusSchema = z.object({
  status: z.enum([
    "draft",
    "submitted",
    "pending_review",
    "approved",
    "rejected",
    "paid",
    "reimbursed",
    "voided",
  ]),
});

function serializeMileage(entry: {
  totalMiles: unknown;
  startOdometer: unknown;
  endOdometer: unknown;
  mileageRate: unknown;
  reimbursement: unknown;
  [key: string]: unknown;
}) {
  return {
    ...entry,
    totalMiles: toNumber(entry.totalMiles),
    startOdometer: entry.startOdometer != null ? toNumber(entry.startOdometer) : null,
    endOdometer: entry.endOdometer != null ? toNumber(entry.endOdometer) : null,
    mileageRate: toNumber(entry.mileageRate),
    reimbursement: toNumber(entry.reimbursement),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceRead(await getRequestUser(request));
    const { id } = await params;

    const entry = await prisma.mileageEntry.findUnique({
      where: { id },
      include: { driver: true, vehicle: true, trip: true },
    });
    if (!entry) return jsonError("Mileage entry not found", 404);
    if (!canViewTransaction(user, entry.driverId)) return jsonError("Forbidden", 403);

    return jsonOk(serializeMileage(entry));
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
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid status", 400);

    const existing = await prisma.mileageEntry.findUnique({ where: { id } });
    if (!existing) return jsonError("Mileage entry not found", 404);

    const entry = await prisma.mileageEntry.update({
      where: { id },
      data: { status: parsed.data.status },
      include: { driver: true, vehicle: true, trip: true },
    });

    await logFinanceAudit("updated", "mileage", id, { user, request }, existing, entry);

    return jsonOk(serializeMileage(entry));
  } catch (error) {
    return handleApiError(error);
  }
}
