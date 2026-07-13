import { NextRequest } from "next/server";
import { tripSchema, toNumber } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead, requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

function serializeTrip(trip: { budget: unknown; [key: string]: unknown }) {
  return {
    ...trip,
    budget: trip.budget != null ? toNumber(trip.budget) : null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const { id } = await params;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        projects: { include: { project: { include: { client: true } } } },
        mileageEntries: true,
      },
    });
    if (!trip) return jsonError("Trip not found", 404);

    return jsonOk({
      ...serializeTrip(trip),
      projectIds: trip.projects.map((p) => p.projectId),
      projects: trip.projects.map((p) => p.project),
    });
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
    const parsed = tripSchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const existing = await prisma.trip.findUnique({ where: { id } });
    if (!existing) return jsonError("Trip not found", 404);

    if (parsed.data.projectIds) {
      await prisma.tripProject.deleteMany({ where: { tripId: id } });
    }

    const trip = await prisma.trip.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.startDate !== undefined
          ? { startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null }
          : {}),
        ...(parsed.data.endDate !== undefined
          ? { endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null }
          : {}),
        ...(parsed.data.state !== undefined ? { state: parsed.data.state } : {}),
        ...(parsed.data.city !== undefined ? { city: parsed.data.city } : {}),
        ...(parsed.data.purpose !== undefined ? { purpose: parsed.data.purpose } : {}),
        ...(parsed.data.budget !== undefined ? { budget: parsed.data.budget } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.projectIds
          ? {
              projects: {
                create: parsed.data.projectIds.map((projectId) => ({ projectId })),
              },
            }
          : {}),
      },
      include: { projects: { include: { project: true } } },
    });

    await logFinanceAudit("updated", "trip", id, { user, request }, existing, trip);

    return jsonOk({
      ...serializeTrip(trip),
      projectIds: trip.projects.map((p) => p.projectId),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;

    const existing = await prisma.trip.findUnique({ where: { id } });
    if (!existing) return jsonError("Trip not found", 404);

    await prisma.trip.delete({ where: { id } });

    await logFinanceAudit("deleted", "trip", id, { user, request }, existing, undefined);

    return jsonOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
