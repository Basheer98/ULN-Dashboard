import { NextRequest } from "next/server";
import { vendorSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead, requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";

    const vendors = await prisma.vendor.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" },
      include: { defaultCategory: true, defaultPaymentMethod: true },
    });

    return jsonOk(vendors);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const body = await request.json();
    const parsed = vendorSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const vendor = await prisma.vendor.create({
      data: {
        name: parsed.data.name,
        vendorType: parsed.data.vendorType,
        contactName: parsed.data.contactName,
        email: parsed.data.email || null,
        phone: parsed.data.phone,
        address: parsed.data.address,
        taxId: parsed.data.taxId,
        defaultCategoryId: parsed.data.defaultCategoryId ?? null,
        defaultPaymentMethodId: parsed.data.defaultPaymentMethodId ?? null,
        notes: parsed.data.notes,
        isActive: parsed.data.isActive ?? true,
      },
      include: { defaultCategory: true, defaultPaymentMethod: true },
    });

    await logFinanceAudit("created", "vendor", vendor.id, { user, request }, undefined, vendor);

    return jsonOk(vendor, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
