import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonOk, requireUser } from "@/lib/api";
import { requireFielderSelf } from "@/lib/finance-auth";
import { serializeReceiptForClient } from "@/lib/receipt-upload";

export async function GET(request: NextRequest) {
  try {
    const user = requireFielderSelf(await getRequestUser(request));

    const receipts = await prisma.receipt.findMany({
      where: {
        deletedAt: null,
        transaction: { fielderId: user.fielderId!, deletedAt: null },
      },
      orderBy: { createdAt: "desc" },
      include: {
        transaction: {
          select: {
            id: true,
            amount: true,
            description: true,
            expenseStatus: true,
            transactionDate: true,
            project: { select: { projectNumber: true } },
            fielder: { select: { id: true, firstName: true, lastName: true } },
            category: { select: { name: true } },
          },
        },
      },
    });

    return jsonOk(receipts.map((receipt) => serializeReceiptForClient(receipt)));
  } catch (error) {
    return handleApiError(error);
  }
}
