import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser } from "@/lib/api";
import { serializeNotification } from "@/lib/notifications";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireOfficeUser(await getRequestUser(request));
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action as "read" | "resolve" | undefined;

    const existing = await prisma.notification.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return jsonError("Notification not found", 404);

    const now = new Date();
    const data: { readAt?: Date; resolvedAt?: Date } = {};

    if (action === "resolve") {
      data.resolvedAt = now;
      data.readAt = existing.readAt ?? now;
    } else {
      data.readAt = now;
    }

    const updated = await prisma.notification.update({
      where: { id },
      data,
    });

    return jsonOk(serializeNotification(updated));
  } catch (error) {
    return handleApiError(error);
  }
}
