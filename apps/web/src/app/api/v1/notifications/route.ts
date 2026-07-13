import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser } from "@/lib/api";
import { serializeNotification } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  try {
    const user = requireOfficeUser(await getRequestUser(request));
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 30), 50);

    const [notifications, unreadCount, openCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
      prisma.notification.count({
        where: { userId: user.id, resolvedAt: null },
      }),
    ]);

    return jsonOk({
      notifications: notifications.map(serializeNotification),
      unreadCount,
      openCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireOfficeUser(await getRequestUser(request));
    const body = await request.json().catch(() => ({}));
    const action = body.action as string | undefined;

    if (action === "read_all") {
      await prisma.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return jsonOk({ ok: true });
    }

    if (action === "resolve_all") {
      await prisma.notification.updateMany({
        where: { userId: user.id, resolvedAt: null },
        data: { resolvedAt: new Date(), readAt: new Date() },
      });
      return jsonOk({ ok: true });
    }

    return jsonError("Unknown action", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
