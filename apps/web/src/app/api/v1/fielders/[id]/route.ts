import { NextRequest } from "next/server";
import { canViewProjectFinancials, fielderSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser, revokeUserSessions } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser, requirePermission } from "@/lib/api";
import { serializeProject, stripProjectMoney } from "@/lib/projects";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireOfficeUser(await getRequestUser(request));
    const { id } = await params;

    const fielder = await prisma.fielder.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, isActive: true, lastLoginAt: true } },
        assignments: { include: { project: true } },
      },
    });

    if (!fielder) return jsonError("Fielder not found", 404);
    const serialized = serializeProject(fielder);
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
    const parsed = fielderSchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const fielder = await prisma.fielder.update({
      where: { id },
      data: parsed.data,
    });

    const serialized = serializeProject(fielder);
    return jsonOk(canSeeMoney ? serialized : stripProjectMoney(serialized));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Soft-delete: marks fielder inactive so they no longer appear in assign pickers. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePermission(await getRequestUser(request), "fielders:write");
    const { id } = await params;

    const existing = await prisma.fielder.findUnique({ where: { id } });
    if (!existing) return jsonError("Fielder not found", 404);
    if (!existing.isActive) {
      return jsonOk({ id: existing.id, isActive: false });
    }

    const fielder = await prisma.fielder.update({
      where: { id },
      data: { isActive: false },
    });

    const linkedUser = await prisma.user.findUnique({ where: { fielderId: id }, select: { id: true } });
    if (linkedUser) await revokeUserSessions(linkedUser.id);

    return jsonOk({ id: fielder.id, isActive: fielder.isActive });
  } catch (error) {
    return handleApiError(error);
  }
}
