import { prisma } from "./prisma";

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  if (!pushToken.startsWith("ExponentPushToken")) {
    return { ok: false, reason: "invalid token" };
  }

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        data: data ?? {},
        sound: "default",
      }),
    });

    const json = await res.json();
    return { ok: res.ok, result: json };
  } catch (err) {
    console.error("Push notification failed:", err);
    return { ok: false, reason: "network error" };
  }
}

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
    { type: "assignment", projectNumber, assignmentId }
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
  await notifyFielderById(
    fielderId,
    "Payment Sent 💰",
    `$${amount.toFixed(2)} for ${projectNumber} has been paid and should arrive soon.`,
    { type: "payment", projectNumber }
  );
}

export async function notifyPaymentApproved(
  fielderId: string,
  projectNumber: string,
  amount: number
) {
  await notifyFielderById(
    fielderId,
    "Payment Approved",
    `$${amount.toFixed(2)} for ${projectNumber} is approved — payment on the way.`,
    { type: "payment_approved", projectNumber }
  );
}

export async function notifyPaymentPending(
  fielderId: string,
  projectNumber: string,
  amount: number
) {
  await notifyFielderById(
    fielderId,
    "Earnings Recorded",
    `$${amount.toFixed(2)} for ${projectNumber} is pending approval.`,
    { type: "payment_pending", projectNumber }
  );
}

export async function notifyExpenseApproved(fielderId: string, amount: number) {
  await notifyFielderById(
    fielderId,
    "Expense Approved",
    `Your $${amount.toFixed(2)} expense was approved.`,
    { type: "expense_approved" }
  );
}

export async function notifyExpenseReimbursed(fielderId: string, amount: number) {
  await notifyFielderById(
    fielderId,
    "Reimbursement Sent",
    `$${amount.toFixed(2)} reimbursement has been processed.`,
    { type: "expense_reimbursed" }
  );
}

export async function notifyExpenseRejected(fielderId: string, amount: number) {
  await notifyFielderById(
    fielderId,
    "Expense Rejected",
    `Your $${amount.toFixed(2)} expense was rejected. Check the app for details.`,
    { type: "expense_rejected" }
  );
}
