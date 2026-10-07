import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, revokeUserSessions } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { logActivity } from "@/lib/activity-log";

/** Signs a team member out: one session with ?sessionId=, otherwise every device. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = requirePermission(await getRequestUser(request), "users:write");
    const { id } = await params;
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!target) return jsonError("Team member not found", 404);

    let revoked = 0;
    if (sessionId) {
      if (actor.id === id && sessionId === actor.sessionId) {
        return jsonError("Use Sign out to end your current session", 400);
      }
      const result = await prisma.session.updateMany({
        where: { id: sessionId, userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      revoked = result.count;
      if (revoked === 0) return jsonError("Session not found or already ended", 404);
    } else {
      const before = await prisma.session.count({
        where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
      });
      await revokeUserSessions(id, actor.id === id ? actor.sessionId : undefined);
      revoked = actor.id === id ? Math.max(before - 1, 0) : before;
    }

    await logActivity({
      entityType: "user",
      entityId: id,
      action: "updated",
      user: actor,
      summary: sessionId
        ? `Signed ${target.email} out of one device`
        : `Signed ${target.email} out of all devices`,
      metadata: { revoked },
    });

    return jsonOk({ revoked });
  } catch (error) {
    return handleApiError(error);
  }
}
