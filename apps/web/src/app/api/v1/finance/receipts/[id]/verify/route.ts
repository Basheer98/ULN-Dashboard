import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

const verifySchema = z.object({
  action: z.enum(["verified", "rejected"]),
  reason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;
    const body = await request.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid verification payload", 400);
    if (parsed.data.action === "rejected" && !parsed.data.reason) {
      return jsonError("Rejection reason required", 400);
    }

    const existing = await prisma.receipt.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return jsonError("Receipt not found", 404);

    const receipt = await prisma.receipt.update({
      where: { id },
      data: { verificationStatus: parsed.data.action },
    });

    await logFinanceAudit(
      parsed.data.action === "verified" ? "verified" : "rejected",
      "receipt",
      id,
      { user, request },
      existing,
      { ...receipt, reason: parsed.data.reason }
    );

    return jsonOk(receipt);
  } catch (error) {
    return handleApiError(error);
  }
}
