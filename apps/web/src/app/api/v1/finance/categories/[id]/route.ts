import { NextRequest } from "next/server";
import { expenseCategorySchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;
    const body = await request.json();
    const parsed = expenseCategorySchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const existing = await prisma.expenseCategory.findUnique({ where: { id } });
    if (!existing) return jsonError("Category not found", 404);

    const category = await prisma.expenseCategory.update({
      where: { id },
      data: parsed.data,
      include: { subcategories: true },
    });

    await logFinanceAudit("updated", "expense_category", id, { user, request }, existing, category);

    return jsonOk(category);
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

    const existing = await prisma.expenseCategory.findUnique({ where: { id } });
    if (!existing) return jsonError("Category not found", 404);

    const category = await prisma.expenseCategory.update({
      where: { id },
      data: { isActive: false },
      include: { subcategories: true },
    });

    await prisma.expenseSubcategory.updateMany({
      where: { categoryId: id },
      data: { isActive: false },
    });

    await logFinanceAudit("deleted", "expense_category", id, { user, request }, existing, category);

    return jsonOk(category);
  } catch (error) {
    return handleApiError(error);
  }
}
