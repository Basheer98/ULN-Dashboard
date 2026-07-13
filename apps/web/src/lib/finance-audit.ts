import { prisma } from "./prisma";
import type { SessionUser } from "./auth";
import type { NextRequest } from "next/server";

export type FinanceAuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "restored"
  | "approved"
  | "rejected"
  | "reimbursed"
  | "reconciled"
  | "exported"
  | "uploaded"
  | "verified";

interface AuditContext {
  user?: SessionUser | null;
  request?: NextRequest;
}

export async function logFinanceAudit(
  action: FinanceAuditAction,
  entityType: string,
  entityId: string,
  context: AuditContext,
  oldValues?: unknown,
  newValues?: unknown
) {
  const ipAddress =
    context.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    context.request?.headers.get("x-real-ip") ??
    null;
  const userAgent = context.request?.headers.get("user-agent") ?? null;

  await prisma.financialAuditLog.create({
    data: {
      userId: context.user?.id ?? null,
      action,
      entityType,
      entityId,
      oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : undefined,
      newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : undefined,
      ipAddress,
      userAgent,
    },
  });
}
