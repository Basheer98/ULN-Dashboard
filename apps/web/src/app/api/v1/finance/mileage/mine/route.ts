import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { requireFielderSelf } from "@/lib/finance-auth";
import { mileagePhotoInclude, serializeMileage } from "@/lib/mileage";

export async function GET(request: NextRequest) {
  try {
    const user = requireFielderSelf(await getRequestUser(request));

    const entries = await prisma.mileageEntry.findMany({
      where: { driverId: user.fielderId! },
      orderBy: { date: "desc" },
      include: { vehicle: true, trip: true, ...mileagePhotoInclude },
    });

    return jsonOk(entries.map(serializeMileage));
  } catch (error) {
    return handleApiError(error);
  }
}
