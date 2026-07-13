import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead, requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

const vehicleSchema = z.object({
  name: z.string().min(1),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";

    const vehicles = await prisma.vehicle.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" },
    });

    return jsonOk(vehicles);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const body = await request.json();
    const parsed = vehicleSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        name: parsed.data.name,
        make: parsed.data.make,
        model: parsed.data.model,
        year: parsed.data.year,
        isActive: parsed.data.isActive ?? true,
      },
    });

    await logFinanceAudit("created", "vehicle", vehicle.id, { user, request }, undefined, vehicle);

    return jsonOk(vehicle, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
