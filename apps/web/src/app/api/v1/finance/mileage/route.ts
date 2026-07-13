import { NextRequest } from "next/server";
import type { Prisma } from "@uln/database";
import {
  mileageSchema,
  calculateMileageReimbursement,
  calculateMilesFromOdometer,
  toNumber,
  hasPermission,
} from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  requireFinanceRead,
  requireFinanceWrite,
  requireFielderSelf,
} from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { getMileageRate } from "@/lib/finance-settings";
import { notifyOfficeMileageSubmitted } from "@/lib/notifications";

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

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const { searchParams } = request.nextUrl;

    const where: Prisma.MileageEntryWhereInput = {};

    const driverId = searchParams.get("driverId");
    if (driverId) where.driverId = driverId;

    const status = searchParams.get("status");
    if (status) where.status = status as never;

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const entries = await prisma.mileageEntry.findMany({
      where,
      orderBy: { date: "desc" },
      include: { driver: true, vehicle: true, trip: true },
    });

    return jsonOk(entries.map(serializeMileage));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return jsonError("Unauthorized", 401);

    const isFielder = user.role === "fielder" && user.fielderId;
    const isAdmin =
      hasPermission(user.role, "finance:write") || hasPermission(user.role, "finance:admin");

    if (!isFielder && !isAdmin) return jsonError("Forbidden", 403);
    if (isFielder && !hasPermission(user.role, "mileage:self:create")) {
      return jsonError("Forbidden", 403);
    }

    const body = await request.json();
    const parsed = mileageSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    let totalMiles = parsed.data.totalMiles;
    if (
      totalMiles == null &&
      parsed.data.startOdometer != null &&
      parsed.data.endOdometer != null
    ) {
      totalMiles = calculateMilesFromOdometer(parsed.data.startOdometer, parsed.data.endOdometer);
    }
    if (!totalMiles || totalMiles <= 0) {
      return jsonError("Total miles required (or provide odometer readings)", 400);
    }

    const rate = await getMileageRate();
    const reimbursement = calculateMileageReimbursement(totalMiles, rate);
    const driverId = isFielder ? user.fielderId! : (body.driverId as string | undefined);
    if (!driverId) return jsonError("driverId required", 400);

    const entry = await prisma.mileageEntry.create({
      data: {
        date: new Date(parsed.data.date),
        driverId,
        vehicleId: parsed.data.vehicleId ?? null,
        startLocation: parsed.data.startLocation,
        destination: parsed.data.destination,
        startOdometer: parsed.data.startOdometer ?? null,
        endOdometer: parsed.data.endOdometer ?? null,
        totalMiles,
        businessPurpose: parsed.data.businessPurpose,
        projectId: parsed.data.projectId ?? null,
        tripId: parsed.data.tripId ?? null,
        isReimbursable: parsed.data.isReimbursable ?? true,
        mileageRate: rate,
        reimbursement,
        status: "submitted",
        notes: parsed.data.notes,
        submittedById: user.id,
      },
      include: { driver: true, vehicle: true, trip: true },
    });

    await logFinanceAudit("created", "mileage", entry.id, { user, request }, undefined, entry);

    if (isFielder && entry.driver) {
      await notifyOfficeMileageSubmitted(
        `${entry.driver.firstName} ${entry.driver.lastName}`,
        toNumber(entry.totalMiles),
        entry.id
      );
    }

    return jsonOk(serializeMileage(entry), 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("odometer")) {
      return jsonError(error.message, 400);
    }
    return handleApiError(error);
  }
}
