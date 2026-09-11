import { prisma } from "./prisma";
import { notifyFielderInApp } from "./notifications";
import { sendPushNotification } from "./push-send";

export { sendPushNotification } from "./push-send";

export async function getFielderPushToken(fielderId: string | null | undefined) {
  if (!fielderId) return null;
  const user = await prisma.user.findFirst({ where: { fielderId } });
  return user?.pushToken ?? null;
}

export async function notifyFielderAssignment(
  pushToken: string | null | undefined,
  projectNumber: string,
  title: string,
  assignmentId: string
) {
  if (!pushToken) return;
  await sendPushNotification(
    pushToken,
    "New Job Assigned",
    `${projectNumber}: ${title}`,
    { type: "assignment", projectNumber, assignmentId, channelId: "jobs" }
  );
}

export async function notifyFielderById(
  fielderId: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  const token = await getFielderPushToken(fielderId);
  if (!token) return;
  await sendPushNotification(token, title, body, data);
}

export async function notifyPaymentSent(
  fielderId: string,
  projectNumber: string,
  amount: number
) {
  await notifyFielderInApp(fielderId, {
    type: "payment_sent",
    title: "Payment Sent",
    body: `$${amount.toFixed(2)} for ${projectNumber} has been paid and should arrive soon.`,
    href: "/earnings",
    entityType: "payment",
    entityId: projectNumber,
    metadata: { projectNumber, amount },
    pushData: { type: "payment", projectNumber },
  });
}

export async function notifyPaymentApproved(
  fielderId: string,
  projectNumber: string,
  amount: number
) {
  await notifyFielderInApp(fielderId, {
    type: "payment_approved",
    title: "Payment Approved",
    body: `$${amount.toFixed(2)} for ${projectNumber} is approved — payment on the way.`,
    href: "/earnings",
    entityType: "payment",
    entityId: projectNumber,
    metadata: { projectNumber, amount },
    pushData: { type: "payment_approved", projectNumber },
  });
}

export async function notifyPaymentPending(
  fielderId: string,
  projectNumber: string,
  amount: number
) {
  await notifyFielderInApp(fielderId, {
    type: "payment_pending",
    title: "Earnings Recorded",
    body: `$${amount.toFixed(2)} for ${projectNumber} is pending approval.`,
    href: "/earnings",
    entityType: "payment",
    entityId: projectNumber,
    metadata: { projectNumber, amount },
    pushData: { type: "payment_pending", projectNumber },
  });
}

export async function notifyExpenseApproved(fielderId: string, amount: number) {
  await notifyFielderInApp(fielderId, {
    type: "expense_approved",
    title: "Expense Approved",
    body: `Your $${amount.toFixed(2)} expense was approved.`,
    href: "/(tabs)/expenses",
    entityType: "expense",
    pushData: { type: "expense_approved" },
  });
}

export async function notifyExpenseReimbursed(fielderId: string, amount: number) {
  await notifyFielderInApp(fielderId, {
    type: "expense_reimbursed",
    title: "Reimbursement Sent",
    body: `$${amount.toFixed(2)} reimbursement has been processed.`,
    href: "/(tabs)/expenses",
    entityType: "expense",
    pushData: { type: "expense_reimbursed" },
  });
}

export async function notifyExpenseRejected(fielderId: string, amount: number) {
  await notifyFielderInApp(fielderId, {
    type: "expense_rejected",
    title: "Expense Rejected",
    body: `Your $${amount.toFixed(2)} expense was rejected. Check the app for details.`,
    href: "/(tabs)/expenses",
    entityType: "expense",
    pushData: { type: "expense_rejected" },
  });
}
