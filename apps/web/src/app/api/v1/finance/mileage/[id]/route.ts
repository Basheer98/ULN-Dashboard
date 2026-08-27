import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  assertCanViewTransaction,
  requireAuthUser,
  requireFinanceWrite,
} from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { mileagePhotoInclude, serializeMileage } from "@/lib/mileage";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuthUser(await getRequestUser(request));
    const { id } = await params;

    const entry = await prisma.mileageEntry.findUnique({
      where: { id },
      include: { driver: true, vehicle: true, trip: true, ...mileagePhotoInclude },
    });
    if (!entry) return jsonError("Mileage entry not found", 404);
    assertCanViewTransaction(user, entry.driverId);

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
      include: { driver: true, vehicle: true, trip: true, ...mileagePhotoInclude },
    });

    await logFinanceAudit("updated", "mileage", id, { user, request }, existing, entry);

    return jsonOk(serializeMileage(entry));
  } catch (error) {
    return handleApiError(error);
  }
}
