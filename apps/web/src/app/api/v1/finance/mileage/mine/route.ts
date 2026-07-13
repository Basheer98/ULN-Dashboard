import { NextRequest } from "next/server";
import { toNumber } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { requireFielderSelf } from "@/lib/finance-auth";

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
    const user = requireFielderSelf(await getRequestUser(request));

    const entries = await prisma.mileageEntry.findMany({
      where: { driverId: user.fielderId! },
      orderBy: { date: "desc" },
      include: { vehicle: true, trip: true },
    });

    return jsonOk(entries.map(serializeMileage));
  } catch (error) {
    return handleApiError(error);
  }
}
