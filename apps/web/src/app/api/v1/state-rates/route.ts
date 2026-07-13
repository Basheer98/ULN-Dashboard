import { NextRequest } from "next/server";
import { stateRateSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { serializeProject } from "@/lib/projects";

export async function GET(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "rates:read");
    const rates = await prisma.stateRate.findMany({ orderBy: { state: "asc" } });
    return jsonOk(serializeProject(rates));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "rates:write");
    const body = await request.json();
    const parsed = stateRateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Invalid input", 400);
    }

    const rate = await prisma.stateRate.upsert({
      where: { state: parsed.data.state },
      create: parsed.data,
      update: {
        clientSqftRate: parsed.data.clientSqftRate,
        fielderSqftRate: parsed.data.fielderSqftRate,
        notes: parsed.data.notes,
      },
    });

    return jsonOk(serializeProject(rate), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
