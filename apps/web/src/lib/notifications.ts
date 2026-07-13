import type { Notification, NotificationType, Prisma, UserRole } from "@uln/database";
import { prisma } from "./prisma";
import { notifyOfficeByEmail } from "./email";
import { sendPushNotification } from "./push";

const OFFICE_ROLES: UserRole[] = ["admin", "dispatcher", "accountant"];

export function serializeNotification(n: Notification) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    entityType: n.entityType,
    entityId: n.entityId,
    readAt: n.readAt?.toISOString() ?? null,
    resolvedAt: n.resolvedAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
    isUnread: !n.readAt,
    isOpen: !n.resolvedAt,
  };
}

async function getOfficeUsers(excludeUserId?: string) {
  return prisma.user.findMany({
    where: {
      role: { in: OFFICE_ROLES },
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true, pushToken: true },
  });
}

export async function notifyOfficeUsers(params: {
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  excludeUserId?: string;
}) {
  const recipients = await getOfficeUsers(params.excludeUserId);
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((user) => ({
      userId: user.id,
      type: params.type,
      title: params.title,
      body: params.body,
      href: params.href ?? null,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
    })),
  });

  await Promise.allSettled(
    recipients
      .filter((user) => user.pushToken)
      .map((user) =>
        sendPushNotification(user.pushToken!, params.title, params.body, {
          type: params.type,
          href: params.href ?? "",
          entityId: params.entityId ?? "",
        })
      )
  );

  await notifyOfficeByEmail(params.title, params.body, params.href);
}

export async function notifyOfficeJobAccepted(
  fielderName: string,
  projectNumber: string,
  projectTitle: string,
  projectId: string,
  assignmentId: string
) {
  await notifyOfficeUsers({
    type: "job_started",
    title: "Job Accepted",
    body: `${fielderName} accepted ${projectNumber}: ${projectTitle}`,
    href: `/projects/${projectId}`,
    entityType: "assignment",
    entityId: assignmentId,
    metadata: { fielderName, projectNumber, projectTitle, projectId, accepted: true },
  });
}

export async function notifyOfficeJobStarted(
  fielderName: string,
  projectNumber: string,
  projectTitle: string,
  projectId: string,
  assignmentId: string
) {
  await notifyOfficeUsers({
    type: "job_started",
    title: "Job Started",
    body: `${fielderName} started ${projectNumber}: ${projectTitle}`,
    href: `/projects/${projectId}`,
    entityType: "assignment",
    entityId: assignmentId,
    metadata: { fielderName, projectNumber, projectTitle, projectId },
  });
}

export async function notifyOfficeJobCompleted(
  fielderName: string,
  projectNumber: string,
  projectTitle: string,
  projectId: string,
  assignmentId: string
) {
  await notifyOfficeUsers({
    type: "job_completed",
    title: "Job Completed",
    body: `${fielderName} completed ${projectNumber}: ${projectTitle}`,
    href: `/projects/${projectId}`,
    entityType: "assignment",
    entityId: assignmentId,
    metadata: { fielderName, projectNumber, projectTitle, projectId },
  });
}

export async function notifyOfficeExpenseSubmitted(
  fielderName: string,
  amount: number,
  expenseId: string,
  transactionNumber: string
) {
  await notifyOfficeUsers({
    type: "expense_submitted",
    title: "Expense Submitted",
    body: `${fielderName} submitted a $${amount.toFixed(2)} expense (${transactionNumber})`,
    href: `/finance/expenses/${expenseId}`,
    entityType: "expense",
    entityId: expenseId,
    metadata: { fielderName, amount, transactionNumber },
  });
}

export async function notifyOfficeMileageSubmitted(
  fielderName: string,
  miles: number,
  mileageId: string
) {
  await notifyOfficeUsers({
    type: "mileage_submitted",
    title: "Mileage Logged",
    body: `${fielderName} logged ${miles.toFixed(1)} miles for reimbursement`,
    href: `/finance/mileage`,
    entityType: "mileage",
    entityId: mileageId,
    metadata: { fielderName, miles },
  });
}
