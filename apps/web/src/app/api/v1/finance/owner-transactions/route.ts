import { NextRequest } from "next/server";
import { ownerTransactionSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import {
  generateTransactionNumber,
  serializeTransaction,
  transactionInclude,
} from "@/lib/finance-transactions";

export async function POST(request: NextRequest) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const body = await request.json();
    const parsed = ownerTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const transactionNumber = await generateTransactionNumber();
    const tx = await prisma.financialTransaction.create({
      data: {
        transactionNumber,
        transactionType: parsed.data.transactionType,
        transactionDate: new Date(parsed.data.transactionDate),
        amount: parsed.data.amount,
        description: parsed.data.description,
        paymentMethodId: parsed.data.paymentMethodId ?? null,
        notes: parsed.data.notes,
        createdById: user.id,
      },
      include: transactionInclude,
    });

    if (parsed.data.paymentMethodId) {
      const method = await prisma.paymentMethod.findUnique({
        where: { id: parsed.data.paymentMethodId },
      });
      if (method) {
        const delta =
          parsed.data.transactionType === "owner_contribution"
            ? parsed.data.amount
            : -parsed.data.amount;
        await prisma.paymentMethod.update({
          where: { id: method.id },
          data: { currentBalance: Number(method.currentBalance) + delta },
        });
      }
    }

    const serialized = serializeTransaction(tx);
    await logFinanceAudit(
      "created",
      parsed.data.transactionType,
      tx.id,
      { user, request },
      undefined,
      serialized
    );

    return jsonOk(serialized, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
