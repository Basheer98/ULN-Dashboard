import { NextRequest } from "next/server";
import { canEnterProjects, canViewProjectFinancials, clientSchema, isOfficeRole } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { ApiError, handleApiError, jsonError, jsonOk, requireOfficeUser, requireUser } from "@/lib/api";
import { serializeProject, stripProjectMoney } from "@/lib/projects";

export async function GET(request: NextRequest) {
  try {
    const user = requireUser(await getRequestUser(request));

    if (!isOfficeRole(user.role)) {
      if (!canEnterProjects(user.role)) throw new ApiError("Forbidden", 403);
      const options = await prisma.client.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
      return jsonOk(options);
    }

    const clients = await prisma.client.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    const serialized = serializeProject(clients);
    return jsonOk(canViewProjectFinancials(user.role) ? serialized : stripProjectMoney(serialized));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireOfficeUser(await getRequestUser(request));

    const body = await request.json();
    const parsed = clientSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const client = await prisma.client.create({
      data: {
        name: parsed.data.name,
        contactName: parsed.data.contactName,
        email: parsed.data.email || null,
        phone: parsed.data.phone,
        defaultSqftRate: parsed.data.defaultSqftRate,
        billingTerms: parsed.data.billingTerms,
        notes: parsed.data.notes,
      },
    });

    return jsonOk(serializeProject(client), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
