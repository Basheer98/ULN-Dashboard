import { NextRequest } from "next/server";
import type { Prisma } from "@uln/database";
import {
  mileageSchema,
  calculateMileageReimbursement,
  calculateMilesFromOdometer,
  hasPermission,
} from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  requireFinanceRead,
  requireFielderSelf,
} from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { getMileageRate } from "@/lib/finance-settings";
import { notifyOfficeMileageSubmitted } from "@/lib/notifications";
import { mileagePhotoInclude, serializeMileage } from "@/lib/mileage";

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
      include: { driver: true, vehicle: true, trip: true, ...mileagePhotoInclude },
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
    if (isFielder) requireFielderSelf(user);

    const body = await request.json();
    const parsed = mileageSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    if (parsed.data.endOdometer <= parsed.data.startOdometer) {
      return jsonError("End odometer must be greater than start odometer", 400);
    }

    let totalMiles: number;
    try {
      totalMiles = calculateMilesFromOdometer(parsed.data.startOdometer, parsed.data.endOdometer);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Invalid odometer readings", 400);
    }

    const [startPhoto, endPhoto] = await Promise.all([
      prisma.mileagePhoto.findFirst({
        where: {
          id: parsed.data.startPhotoId,
          kind: "start_odometer",
          deletedAt: null,
          mileageEntryId: null,
        },
      }),
      prisma.mileagePhoto.findFirst({
        where: {
          id: parsed.data.endPhotoId,
          kind: "end_odometer",
          deletedAt: null,
          mileageEntryId: null,
        },
      }),
    ]);

    if (!startPhoto) return jsonError("Start odometer photo not found or already used", 400);
    if (!endPhoto) return jsonError("End odometer photo not found or already used", 400);

    if (user.role === "fielder") {
      if (startPhoto.uploadedById !== user.id || endPhoto.uploadedById !== user.id) {
        return jsonError("Odometer photos must be uploaded by you", 403);
      }
    }

    if (parsed.data.startPhotoId === parsed.data.endPhotoId) {
      return jsonError("Start and end odometer photos must be different images", 400);
    }

    const rate = await getMileageRate();
    const reimbursement = calculateMileageReimbursement(totalMiles, rate);
    const driverId = isFielder ? user.fielderId! : (body.driverId as string | undefined);
    if (!driverId) return jsonError("driverId required", 400);

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.mileageEntry.create({
        data: {
          date: new Date(parsed.data.date),
          driverId,
          vehicleId: parsed.data.vehicleId ?? null,
          startLocation: parsed.data.startLocation,
          destination: parsed.data.destination,
          startOdometer: parsed.data.startOdometer,
          endOdometer: parsed.data.endOdometer,
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
      });

      await tx.mileagePhoto.updateMany({
        where: { id: { in: [startPhoto.id, endPhoto.id] } },
        data: { mileageEntryId: created.id },
      });

      return tx.mileageEntry.findUniqueOrThrow({
        where: { id: created.id },
        include: { driver: true, vehicle: true, trip: true, ...mileagePhotoInclude },
      });
    });

    await logFinanceAudit("created", "mileage", entry.id, { user, request }, undefined, entry);

    if (isFielder && entry.driver) {
      await notifyOfficeMileageSubmitted(
        `${entry.driver.firstName} ${entry.driver.lastName}`,
        totalMiles,
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
