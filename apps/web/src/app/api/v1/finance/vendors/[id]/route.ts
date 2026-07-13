import { NextRequest } from "next/server";
import { vendorSchema } from "@uln/shared";
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

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: { defaultCategory: true, defaultPaymentMethod: true },
    });
    if (!vendor) return jsonError("Vendor not found", 404);

    return jsonOk(vendor);
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
    const parsed = vendorSchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) return jsonError("Vendor not found", 404);

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        ...parsed.data,
        email: parsed.data.email === "" ? null : parsed.data.email,
      },
      include: { defaultCategory: true, defaultPaymentMethod: true },
    });

    await logFinanceAudit("updated", "vendor", id, { user, request }, existing, vendor);

    return jsonOk(vendor);
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

    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) return jsonError("Vendor not found", 404);

    const vendor = await prisma.vendor.update({
      where: { id },
      data: { isActive: false },
    });

    await logFinanceAudit("deleted", "vendor", id, { user, request }, existing, vendor);

    return jsonOk(vendor);
  } catch (error) {
    return handleApiError(error);
  }
}
