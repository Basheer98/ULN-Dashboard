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

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const status = request.nextUrl.searchParams.get("status");

    const trips = await prisma.trip.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { startDate: "desc" },
      include: {
        projects: { include: { project: { include: { client: true } } } },
      },
    });

    return jsonOk(
      trips.map((t) => ({
        ...serializeTrip(t),
        projectIds: t.projects.map((p) => p.projectId),
        projects: t.projects.map((p) => p.project),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const body = await request.json();
    const parsed = tripSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const trip = await prisma.trip.create({
      data: {
        name: parsed.data.name,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        state: parsed.data.state,
        city: parsed.data.city,
        purpose: parsed.data.purpose,
        budget: parsed.data.budget ?? null,
        status: parsed.data.status ?? "planned",
        notes: parsed.data.notes,
        projects: parsed.data.projectIds?.length
          ? {
              create: parsed.data.projectIds.map((projectId) => ({ projectId })),
            }
          : undefined,
      },
      include: {
        projects: { include: { project: true } },
      },
    });

    await logFinanceAudit("created", "trip", trip.id, { user, request }, undefined, trip);

    return jsonOk(
      {
        ...serializeTrip(trip),
        projectIds: trip.projects.map((p) => p.projectId),
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
