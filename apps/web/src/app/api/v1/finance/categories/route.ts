import { NextRequest } from "next/server";
import { expenseCategorySchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead, requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";

    const categories = await prisma.expenseCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        subcategories: {
          where: includeInactive ? undefined : { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
    });

    return jsonOk(categories);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const body = await request.json();
    const parsed = expenseCategorySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const category = await prisma.expenseCategory.create({
      data: {
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder ?? 0,
        isActive: parsed.data.isActive ?? true,
      },
      include: { subcategories: true },
    });

    await logFinanceAudit("created", "expense_category", category.id, { user, request }, undefined, category);

    return jsonOk(category, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
