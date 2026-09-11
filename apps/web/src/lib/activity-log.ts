import { prisma } from "./prisma";
import type { SessionUser } from "./auth";

export type ActivityAction = "created" | "updated" | "deleted" | "restored";

interface LogActivityInput {
  entityType: string;
  entityId: string;
  action: ActivityAction;
  user?: SessionUser | null;
  summary: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity({
  entityType,
  entityId,
  action,
  user,
  summary,
  metadata = {},
}: LogActivityInput) {
  await prisma.activityLog.create({
    data: {
      entityType,
      entityId,
      action,
      userId: user?.id ?? null,
      metadata: {
        summary,
        userEmail: user?.email ?? null,
        userId: user?.id ?? null,
        ...metadata,
      },
    },
  });
}

export async function getEntityActivity(entityType: string, entityId: string, take = 50) {
  return prisma.activityLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });
}
