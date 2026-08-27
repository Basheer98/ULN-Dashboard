import { NextRequest } from "next/server";
import { z } from "zod";
import { toNumber } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { serializeTransaction, transactionInclude } from "@/lib/finance-transactions";
import { notifyExpenseReimbursed } from "@/lib/push";

const batchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

export async function POST(request: NextRequest) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const body = await request.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const expenses = await prisma.financialTransaction.findMany({
      where: {
        id: { in: parsed.data.ids },
        transactionType: "expense",
        deletedAt: null,
      },
    });

    const byId = new Map(expenses.map((e) => [e.id, e]));
    const reimbursed: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const id of parsed.data.ids) {
      const existing = byId.get(id);
      if (!existing) {
        skipped.push({ id, reason: "Not found" });
        continue;
      }
      if (!existing.isReimbursable) {
        skipped.push({ id, reason: "Not reimbursable" });
        continue;
      }
      if (existing.expenseStatus !== "approved") {
        skipped.push({ id, reason: `Status is ${existing.expenseStatus ?? "unknown"}` });
        continue;
      }

      const updated = await prisma.financialTransaction.update({
        where: { id },
        data: {
          expenseStatus: "reimbursed",
          reimbursedAt: new Date(),
        },
        include: transactionInclude,
      });

      await logFinanceAudit("reimbursed", "expense", id, { user, request }, existing, updated);

      if (existing.fielderId) {
        await notifyExpenseReimbursed(existing.fielderId, toNumber(existing.amount));
      }

      reimbursed.push(id);
    }

    const refreshed = await prisma.financialTransaction.findMany({
      where: { id: { in: reimbursed } },
      include: transactionInclude,
    });

    return jsonOk({
      reimbursedCount: reimbursed.length,
      skippedCount: skipped.length,
      reimbursed: refreshed.map(serializeTransaction),
      skipped,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
