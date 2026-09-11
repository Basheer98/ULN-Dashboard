import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { recordFielderPayment, paymentRemaining } from "@/lib/fielder-payments";
import { toNumber } from "@uln/shared";

const batchSchema = z.object({
  paymentIds: z.array(z.string().min(1)).min(1),
  /** Optional fixed amount per payment; default = remaining owed. */
  payAmount: z.coerce.number().min(0.01).optional(),
  referenceNumber: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = requirePermission(await getRequestUser(request), "payments:write");
    const body = await request.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) return jsonError("Select at least one payment", 400);

    const existing = await prisma.fielderPayment.findMany({
      where: {
        id: { in: parsed.data.paymentIds },
        status: { in: ["pending", "approved", "partial"] },
      },
    });

    if (existing.length === 0) {
      return jsonError("No unpaid payments found for selection", 400);
    }

    let paid = 0;
    const ids: string[] = [];

    for (const payment of existing) {
      const remaining = paymentRemaining(
        toNumber(payment.totalAmount),
        toNumber(payment.amountPaid)
      );
      if (remaining <= 0) continue;
      const amount = parsed.data.payAmount ?? remaining;
      await recordFielderPayment(payment.id, {
        amount,
        referenceNumber: parsed.data.referenceNumber,
        user,
      });
      paid += 1;
      ids.push(payment.id);
    }

    return jsonOk({ paid, ids });
  } catch (error) {
    return handleApiError(error);
  }
}
