import { NextRequest } from "next/server";
import { canViewProjectFinancials, clientSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser, requirePermission } from "@/lib/api";
import { serializeProject, stripProjectMoney } from "@/lib/projects";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireOfficeUser(await getRequestUser(request));
    const { id } = await params;

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) return jsonError("Client not found", 404);

    const serialized = serializeProject(client);
    return jsonOk(canViewProjectFinancials(user.role) ? serialized : stripProjectMoney(serialized));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireOfficeUser(await getRequestUser(request));
    const canSeeMoney = canViewProjectFinancials(user.role);
    const { id } = await params;
    const body = await request.json();
    if (!canSeeMoney && body && typeof body === "object") delete body.defaultSqftRate;
    const parsed = clientSchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const client = await prisma.client.update({
      where: { id },
      data: parsed.data,
    });

    const serialized = serializeProject(client);
    return jsonOk(canSeeMoney ? serialized : stripProjectMoney(serialized));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Soft-delete: marks client inactive so it no longer appears in pickers. Projects/invoices stay. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePermission(await getRequestUser(request), "clients:write");
    const { id } = await params;

    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) return jsonError("Client not found", 404);
    if (!existing.isActive) {
      return jsonOk({ id: existing.id, isActive: false });
    }

    const client = await prisma.client.update({
      where: { id },
      data: { isActive: false },
    });

    return jsonOk({ id: client.id, isActive: client.isActive });
  } catch (error) {
    return handleApiError(error);
  }
}
