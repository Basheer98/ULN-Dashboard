import { NextRequest } from "next/server";
import { z } from "zod";
import { toNumber, calculateReconciliationDifference } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead, requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

function serializeReconciliation(rec: {
  startingBalance: unknown;
  endingBalance: unknown;
  clearedTotal: unknown;
  difference: unknown;
  items?: { amount: unknown; [key: string]: unknown }[];
  [key: string]: unknown;
}) {
  return {
    ...rec,
    startingBalance: toNumber(rec.startingBalance),
    endingBalance: toNumber(rec.endingBalance),
    clearedTotal: toNumber(rec.clearedTotal),
    difference: toNumber(rec.difference),
    items: rec.items?.map((item) => ({
      ...item,
      amount: toNumber(item.amount),
    })),
  };
}

const updateSchema = z.object({
  notes: z.string().optional(),
  endingBalance: z.coerce.number().optional(),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        transactionId: z.string().optional().nullable(),
        description: z.string().optional(),
        amount: z.coerce.number(),
        transactionDate: z.string().optional().nullable(),
        isCleared: z.boolean(),
        isManual: z.boolean().optional(),
      })
    )
    .optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const { id } = await params;

    const reconciliation = await prisma.bankReconciliation.findUnique({
      where: { id },
      include: {
        paymentMethod: true,
        items: { include: { transaction: true }, orderBy: { transactionDate: "asc" } },
      },
    });
    if (!reconciliation) return jsonError("Reconciliation not found", 404);

    return jsonOk(serializeReconciliation(reconciliation));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const existing = await prisma.bankReconciliation.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) return jsonError("Reconciliation not found", 404);

    if (parsed.data.items) {
      await prisma.reconciliationItem.deleteMany({ where: { reconciliationId: id } });
      await prisma.reconciliationItem.createMany({
        data: parsed.data.items.map((item) => ({
          reconciliationId: id,
          transactionId: item.transactionId ?? null,
          description: item.description,
          amount: item.amount,
          transactionDate: item.transactionDate ? new Date(item.transactionDate) : null,
          isCleared: item.isCleared,
          isManual: item.isManual ?? !item.transactionId,
        })),
      });
    }

    const items = parsed.data.items ?? existing.items;
    const clearedTotal = items
      .filter((i) => i.isCleared)
      .reduce((sum, i) => sum + toNumber(i.amount), 0);

    const endingBalance =
      parsed.data.endingBalance !== undefined
        ? parsed.data.endingBalance
        : toNumber(existing.endingBalance);

    const difference = calculateReconciliationDifference(
      toNumber(existing.startingBalance),
      clearedTotal,
      endingBalance
    );

    const reconciliation = await prisma.bankReconciliation.update({
      where: { id },
      data: {
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.endingBalance !== undefined
          ? { endingBalance: parsed.data.endingBalance }
          : {}),
        clearedTotal,
        difference,
        status: difference === 0 ? "balanced" : "in_progress",
      },
      include: {
        paymentMethod: true,
        items: { include: { transaction: true } },
      },
    });

    await logFinanceAudit(
      "updated",
      "reconciliation",
      id,
      { user, request },
      existing,
      reconciliation
    );

    return jsonOk(serializeReconciliation(reconciliation));
  } catch (error) {
    return handleApiError(error);
  }
}
