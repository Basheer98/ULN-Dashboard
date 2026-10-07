import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { passwordSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser, revokeUserSessions } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { serializeProject } from "@/lib/projects";
import { logActivity } from "@/lib/activity-log";

const updateSchema = z.object({
  role: z.enum(["admin", "dispatcher", "accountant", "coordinator"]).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = requirePermission(await getRequestUser(request), "users:write");
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Invalid input", 400);

    const target = await prisma.user.findUnique({
      where: { id },
      select: { email: true, role: true, isActive: true, firstName: true, lastName: true },
    });
    if (!target) return jsonError("Team member not found", 404);
    if (target.role === "fielder") {
      return jsonError("Fielder logins are managed from the Fielders page", 400);
    }

    const losesAdmin =
      parsed.data.isActive === false || (parsed.data.role && parsed.data.role !== "admin");
    if (losesAdmin) {
      if (target.role === "admin" && target.isActive) {
        const otherAdmins = await prisma.user.count({
          where: { role: "admin", isActive: true, id: { not: id } },
        });
        if (otherAdmins === 0) return jsonError("There must be at least one active admin", 400);
      }
    }

    const data: Record<string, unknown> = { ...parsed.data };
    delete data.password;
    if (parsed.data.password) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, role: true, firstName: true, lastName: true, isActive: true,
      },
    });

    if (parsed.data.password || parsed.data.isActive === false) {
      await revokeUserSessions(id, actor.id === id ? actor.sessionId : undefined);
    }

    const notes: string[] = [];
    if (parsed.data.role && parsed.data.role !== target.role) {
      notes.push(`role ${target.role} → ${parsed.data.role}`);
    }
    if (
      (parsed.data.firstName !== undefined && parsed.data.firstName !== (target.firstName ?? "")) ||
      (parsed.data.lastName !== undefined && parsed.data.lastName !== (target.lastName ?? ""))
    ) {
      notes.push("name");
    }
    if (parsed.data.password) notes.push("password reset");
    if (parsed.data.isActive === true && !target.isActive) notes.push("restored");
    if (parsed.data.isActive === false && target.isActive) notes.push("deactivated");
    if (notes.length > 0) {
      await logActivity({
        entityType: "user",
        entityId: id,
        action: parsed.data.isActive === true && !target.isActive ? "restored" : "updated",
        user: actor,
        summary: `Updated ${target.email}: ${notes.join(", ")}`,
        metadata: { notes },
      });
    }

    return jsonOk(serializeProject(user));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Removes a team member. Accounts with any recorded history are deactivated instead of
 * deleted so audit trails keep pointing at a real person; either way their logins end now.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = requirePermission(await getRequestUser(request), "users:write");
    const { id } = await params;

    if (id === actor.id) return jsonError("You can't remove your own account", 400);

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        _count: {
          select: {
            projectsCreated: true,
            attachments: true,
            activityLogs: true,
            financeTransactionsCreated: true,
            financeTransactionsReviewed: true,
            receiptsUploaded: true,
            mileagePhotosUploaded: true,
            financeAuditLogs: true,
            mileageEntries: true,
            fielderPaymentEvents: true,
          },
        },
      },
    });
    if (!target) return jsonError("Team member not found", 404);
    if (target.role === "fielder") {
      return jsonError("Fielder logins are managed from the Fielders page", 400);
    }

    if (target.role === "admin" && target.isActive) {
      const otherAdmins = await prisma.user.count({
        where: { role: "admin", isActive: true, id: { not: id } },
      });
      if (otherAdmins === 0) return jsonError("You can't remove the last active admin", 400);
    }

    await revokeUserSessions(id);

    const hasHistory = Object.values(target._count).some((count) => count > 0);
    if (hasHistory) {
      await prisma.user.update({ where: { id }, data: { isActive: false } });
    } else {
      await prisma.user.delete({ where: { id } });
    }

    await logActivity({
      entityType: "user",
      entityId: id,
      action: "deleted",
      user: actor,
      summary: `${target.email} ${hasHistory ? "deactivated" : "deleted"} by ${actor.email}`,
      metadata: { role: target.role, mode: hasHistory ? "deactivated" : "deleted" },
    });

    return jsonOk({ id, mode: hasHistory ? "deactivated" : "deleted" });
  } catch (error) {
    return handleApiError(error);
  }
}
