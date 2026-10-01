import { NextRequest } from "next/server";
import { operatingCostSchema, toNumber } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

const operatingCostUpdateSchema = operatingCostSchema.partial();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;
    const parsed = operatingCostUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const existing = await prisma.operatingCost.findUnique({ where: { id } });
    if (!existing) return jsonError("Operating cost not found", 404);

    const data = parsed.data;
    const startDate =
      data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : existing.startDate;
    const endDate =
      data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : existing.endDate;
    if (startDate && endDate && endDate < startDate) {
      return jsonError("End date must be after start date", 400);
    }

    const cost = await prisma.operatingCost.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId || null } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.frequency !== undefined ? { frequency: data.frequency } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        startDate,
        endDate,
      },
    });

    await logFinanceAudit("updated", "operating_cost", id, { user, request }, existing, cost);

    return jsonOk({ ...cost, amount: toNumber(cost.amount) });
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

    const existing = await prisma.operatingCost.findUnique({ where: { id } });
    if (!existing) return jsonError("Operating cost not found", 404);

    await prisma.operatingCost.delete({ where: { id } });
    await logFinanceAudit("deleted", "operating_cost", id, { user, request }, existing);

    return jsonOk({ id });
  } catch (error) {
    return handleApiError(error);
  }
}
