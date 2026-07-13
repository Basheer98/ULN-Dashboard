import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { serializeProject } from "@/lib/projects";
import { notifyPaymentApproved, notifyPaymentSent } from "@/lib/push";
import { toNumber } from "@uln/shared";

const updateSchema = z.object({
  status: z.enum(["pending", "approved", "paid"]).optional(),
  paymentMethod: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePermission(await getRequestUser(request), "payments:write");
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    const existing = await prisma.fielderPayment.findUnique({ where: { id } });
    if (!existing) return jsonError("Payment not found", 404);

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.status === "paid") {
      data.paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();
    }
    if (parsed.data.paidAt) data.paidAt = new Date(parsed.data.paidAt);

    const wasPaid = parsed.data.status === "paid" && existing.status !== "paid";
    const wasApproved = parsed.data.status === "approved" && existing.status !== "approved";
    const payment = await prisma.fielderPayment.update({
      where: { id },
      data,
      include: { fielder: true, project: true },
    });

    if (wasApproved && payment.fielderId) {
      await notifyPaymentApproved(
        payment.fielderId,
        payment.project?.projectNumber ?? "Project",
        toNumber(payment.totalAmount)
      );
    }

    if (wasPaid && payment.fielderId) {
      await notifyPaymentSent(
        payment.fielderId,
        payment.project?.projectNumber ?? "Project",
        toNumber(payment.totalAmount)
      );
    }

    return jsonOk(serializeProject(payment));
  } catch (error) {
    return handleApiError(error);
  }
}
