import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead, requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const { id } = await params;

    const receipt = await prisma.receipt.findFirst({
      where: { id, deletedAt: null },
      include: {
        uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        transaction: true,
      },
    });
    if (!receipt) return jsonError("Receipt not found", 404);

    return jsonOk(receipt);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;

    const existing = await prisma.receipt.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return jsonError("Receipt not found", 404);

    const receipt = await prisma.receipt.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logFinanceAudit("deleted", "receipt", id, { user, request }, existing, receipt);

    return jsonOk(receipt);
  } catch (error) {
    return handleApiError(error);
  }
}
