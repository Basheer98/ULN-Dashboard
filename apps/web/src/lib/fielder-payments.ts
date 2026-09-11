import { prisma } from "./prisma";
import { toNumber } from "@uln/shared";
import type { SessionUser } from "./auth";
import { notifyPaymentSent } from "./push";

export function paymentRemaining(totalAmount: number, amountPaid: number): number {
  return Math.max(0, Math.round((totalAmount - amountPaid) * 100) / 100);
}

export function paymentStatusForAmounts(
  totalAmount: number,
  amountPaid: number,
  previousStatus: string
): "pending" | "approved" | "partial" | "paid" {
  if (amountPaid <= 0) {
    return previousStatus === "approved" ? "approved" : "pending";
  }
  if (amountPaid + 0.001 >= totalAmount) return "paid";
  return "partial";
}

/** Record a payment installment. Keeps owed totalAmount; increments amountPaid. */
export async function recordFielderPayment(
  paymentId: string,
  input: {
    amount: number;
    referenceNumber?: string;
    paymentMethod?: string;
    notes?: string;
    user?: SessionUser | null;
  }
) {
  const existing = await prisma.fielderPayment.findUnique({
    where: { id: paymentId },
    include: { project: true },
  });
  if (!existing) throw new Error("Payment not found");

  const owed = toNumber(existing.totalAmount);
  const alreadyPaid = toNumber(existing.amountPaid);
  const remaining = paymentRemaining(owed, alreadyPaid);
  if (remaining <= 0) throw new Error("Payment is already fully paid");

  const payAmount = Math.round(input.amount * 100) / 100;
  if (!(payAmount > 0)) throw new Error("Amount must be greater than zero");

  const applied = Math.min(payAmount, remaining);
  const nextPaid = Math.round((alreadyPaid + applied) * 100) / 100;
  const nextStatus = paymentStatusForAmounts(owed, nextPaid, existing.status);
  const paidAt = new Date();

  await prisma.fielderPaymentEvent.create({
    data: {
      paymentId,
      amount: applied,
      paidAt,
      referenceNumber: input.referenceNumber,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
      createdById: input.user?.id,
    },
  });

  const updated = await prisma.fielderPayment.update({
    where: { id: paymentId },
    data: {
      amountPaid: nextPaid,
      status: nextStatus,
      // Keep first cash date for history; always set if previously unpaid
      paidAt: existing.paidAt ?? paidAt,
      referenceNumber: input.referenceNumber ?? existing.referenceNumber,
      paymentMethod: input.paymentMethod ?? existing.paymentMethod,
    },
    include: {
      project: true,
      fielder: true,
      events: { orderBy: { paidAt: "desc" } },
    },
  });

  await notifyPaymentSent(
    updated.fielderId,
    updated.project?.projectNumber ?? "Project",
    applied
  );

  return {
    payment: updated,
    applied,
    remaining: paymentRemaining(owed, nextPaid),
  };
}
