import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { serializeProject } from "@/lib/projects";
import { notifyPaymentApproved } from "@/lib/push";
import { toNumber } from "@uln/shared";
import { recordFielderPayment } from "@/lib/fielder-payments";

const updateSchema = z.object({
  status: z.enum(["pending", "approved", "partial", "paid"]).optional(),
  /** Installment amount — increments amountPaid; does not replace owed total. */
  payAmount: z.coerce.number().min(0.01).optional(),
  /** @deprecated use payAmount — still accepted for backwards compatibility as installment */
  totalAmount: z.coerce.number().min(0).optional(),
  paymentMethod: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePermission(await getRequestUser(request), "payments:read");
    const { id } = await params;
    const payment = await prisma.fielderPayment.findUnique({
      where: { id },
      include: {
        fielder: true,
        project: true,
        events: {
          orderBy: { paidAt: "desc" },
          include: {
            createdBy: { select: { email: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!payment) return jsonError("Payment not found", 404);

    return jsonOk({
      ...serializeProject(payment),
      totalAmount: toNumber(payment.totalAmount),
      amountPaid: toNumber(payment.amountPaid),
      remaining: Math.max(0, toNumber(payment.totalAmount) - toNumber(payment.amountPaid)),
      events: payment.events.map((e) => ({
        id: e.id,
        amount: toNumber(e.amount),
        paidAt: e.paidAt.toISOString(),
        referenceNumber: e.referenceNumber,
        paymentMethod: e.paymentMethod,
        notes: e.notes,
        createdBy:
          e.createdBy?.email ||
          [e.createdBy?.firstName, e.createdBy?.lastName].filter(Boolean).join(" ") ||
          null,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requirePermission(await getRequestUser(request), "payments:write");
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    const existing = await prisma.fielderPayment.findUnique({ where: { id } });
    if (!existing) return jsonError("Payment not found", 404);

    const payAmount = parsed.data.payAmount ?? parsed.data.totalAmount;
    const isPayAction =
      payAmount !== undefined ||
      parsed.data.status === "paid" ||
      (parsed.data.status === "partial" && payAmount !== undefined);

    if (isPayAction && (parsed.data.status === "paid" || payAmount !== undefined)) {
      const remaining = Math.max(
        0,
        toNumber(existing.totalAmount) - toNumber(existing.amountPaid)
      );
      const amount =
        payAmount !== undefined
          ? payAmount
          : remaining > 0
            ? remaining
            : toNumber(existing.totalAmount);

      try {
        const result = await recordFielderPayment(id, {
          amount,
          referenceNumber: parsed.data.referenceNumber,
          paymentMethod: parsed.data.paymentMethod,
          notes: parsed.data.notes,
          user,
        });
        return jsonOk(serializeProject(result.payment));
      } catch (err) {
        return jsonError(err instanceof Error ? err.message : "Payment failed", 400);
      }
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.status === "approved" || parsed.data.status === "pending") {
      data.status = parsed.data.status;
    }
    if (parsed.data.paymentMethod !== undefined) data.paymentMethod = parsed.data.paymentMethod;
    if (parsed.data.referenceNumber !== undefined) {
      data.referenceNumber = parsed.data.referenceNumber;
    }
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

    const wasApproved = parsed.data.status === "approved" && existing.status !== "approved";
    const payment = await prisma.fielderPayment.update({
      where: { id },
      data,
      include: { fielder: true, project: true, events: { orderBy: { paidAt: "desc" } } },
    });

    if (wasApproved && payment.fielderId) {
      await notifyPaymentApproved(
        payment.fielderId,
        payment.project?.projectNumber ?? "Project",
        toNumber(payment.totalAmount) - toNumber(payment.amountPaid)
      );
    }

    return jsonOk(serializeProject(payment));
  } catch (error) {
    return handleApiError(error);
  }
}
