import { prisma } from "./prisma";
import {
  calculateClientTotal,
  calculateFielderTotal,
  toNumber,
} from "@uln/shared";
import type { SessionUser } from "./auth";
import { logActivity } from "./activity-log";
import { logFinanceAudit } from "./finance-audit";
import type { NextRequest } from "next/server";

export const activeProjectWhere = { deletedAt: null } as const;

export async function getProjectFinancials(projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      lineItems: true,
      assignments: {
        include: { fielder: true },
      },
    },
  });
  if (!project) {
    throw new Error("Project not found");
  }

  const sqft = toNumber(project.sqft);
  const clientRate = toNumber(project.clientSqftRate);

  const clientLineItems = project.lineItems
    .filter((item) => item.type === "client_billing")
    .map((item) => ({ amount: toNumber(item.amount) }));

  const clientTotals = calculateClientTotal(sqft, clientRate, clientLineItems);

  const fielderBreakdown = project.assignments.map((assignment) => {
    const fielderRate = toNumber(assignment.fielderSqftRate);
    const assignedSqft = toNumber(assignment.assignedSqft) || sqft;
    const fielderLineItems = project.lineItems
      .filter(
        (item) =>
          item.type === "fielder_payout" &&
          (item.fielderId === assignment.fielderId || !item.fielderId)
      )
      .map((item) => ({ amount: toNumber(item.amount) }));

    const totals = calculateFielderTotal(assignedSqft, fielderRate, fielderLineItems);

    return {
      assignmentId: assignment.id,
      fielderId: assignment.fielderId,
      fielderName: `${assignment.fielder.firstName} ${assignment.fielder.lastName}`,
      employmentType: assignment.fielder.employmentType,
      fielderSqftRate: fielderRate,
      assignedSqft,
      ...totals,
    };
  });

  const totalFielderPay = fielderBreakdown.reduce((sum, f) => sum + f.total, 0);
  const margin = clientTotals.total - totalFielderPay;

  return {
    sqft,
    clientSqftRate: clientRate,
    client: clientTotals,
    fielders: fielderBreakdown,
    totalFielderPay,
    margin,
  };
}

export function serializeProject<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, val) =>
      typeof val === "object" && val !== null && "toFixed" in val
        ? Number(val)
        : val
    )
  ) as T;
}

async function linkedExpenseIds(projectId: string): Promise<string[]> {
  const [direct, allocated] = await Promise.all([
    prisma.financialTransaction.findMany({
      where: {
        deletedAt: null,
        projectId,
        transactionType: "expense",
      },
      select: { id: true },
    }),
    prisma.expenseAllocation.findMany({
      where: {
        projectId,
        transaction: { deletedAt: null, transactionType: "expense" },
      },
      select: { transactionId: true },
    }),
  ]);

  return [...new Set([...direct.map((e) => e.id), ...allocated.map((a) => a.transactionId)])];
}

export async function softDeleteProject(
  projectId: string,
  user: SessionUser,
  request?: NextRequest
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.deletedAt) return null;

  const expenseIds = await linkedExpenseIds(projectId);
  const deletedAt = new Date();

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { deletedAt },
    }),
    ...(expenseIds.length > 0
      ? [
          prisma.financialTransaction.updateMany({
            where: { id: { in: expenseIds }, deletedAt: null },
            data: { deletedAt },
          }),
        ]
      : []),
  ]);

  for (const expenseId of expenseIds) {
    await logFinanceAudit(
      "deleted",
      "expense",
      expenseId,
      { user, request },
      { reason: "project_soft_delete", projectId },
      { deletedAt }
    );
  }

  const email = user.email;
  await logActivity({
    entityType: "project",
    entityId: projectId,
    action: "deleted",
    user,
    summary: `Deleted by ${email}`,
    metadata: {
      projectNumber: project.projectNumber,
      title: project.title,
      softDeletedExpenseIds: expenseIds,
      expenseCount: expenseIds.length,
    },
  });

  return { project, expenseIds, deletedAt };
}

export async function restoreProject(
  projectId: string,
  user: SessionUser,
  request?: NextRequest
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project?.deletedAt) return null;

  const lastDelete = await prisma.activityLog.findFirst({
    where: { entityType: "project", entityId: projectId, action: "deleted" },
    orderBy: { createdAt: "desc" },
  });
  const meta = (lastDelete?.metadata ?? {}) as {
    softDeletedExpenseIds?: string[];
  };
  const expenseIds = meta.softDeletedExpenseIds ?? [];

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: null },
    }),
    ...(expenseIds.length > 0
      ? [
          prisma.financialTransaction.updateMany({
            where: { id: { in: expenseIds } },
            data: { deletedAt: null },
          }),
        ]
      : []),
  ]);

  for (const expenseId of expenseIds) {
    await logFinanceAudit(
      "restored",
      "expense",
      expenseId,
      { user, request },
      { reason: "project_restore", projectId },
      { deletedAt: null }
    );
  }

  await logActivity({
    entityType: "project",
    entityId: projectId,
    action: "restored",
    user,
    summary: `Restored by ${user.email}`,
    metadata: {
      projectNumber: project.projectNumber,
      title: project.title,
      restoredExpenseIds: expenseIds,
      expenseCount: expenseIds.length,
    },
  });

  return { project, expenseIds };
}

export function projectFieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of keys) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[key] = { from, to };
    }
  }
  return changes;
}
