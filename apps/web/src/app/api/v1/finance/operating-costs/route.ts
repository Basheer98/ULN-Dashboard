import { NextRequest } from "next/server";
import { operatingCostSchema, toNumber } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead, requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

function serializeOperatingCost<T extends { amount: unknown }>(cost: T) {
  return { ...cost, amount: toNumber(cost.amount) };
}

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const costs = await prisma.operatingCost.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { category: { select: { id: true, name: true } } },
    });
    return jsonOk(costs.map(serializeOperatingCost));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const parsed = operatingCostSchema.safeParse(await request.json());
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }
    const data = parsed.data;
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      return jsonError("End date must be after start date", 400);
    }

    const cost = await prisma.operatingCost.create({
      data: {
        name: data.name,
        categoryId: data.categoryId || null,
        amount: data.amount,
        frequency: data.frequency,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        isActive: data.isActive ?? true,
        notes: data.notes || null,
      },
    });

    await logFinanceAudit("created", "operating_cost", cost.id, { user, request }, undefined, cost);

    return jsonOk(serializeOperatingCost(cost), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
