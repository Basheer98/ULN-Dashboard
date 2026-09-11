import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, requirePermission } from "@/lib/api";
import { toNumber } from "@uln/shared";
import type { Prisma } from "@uln/database";

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "payments:read");
    const { searchParams } = request.nextUrl;
    const fielderId = searchParams.get("fielderId") || undefined;
    const status = searchParams.get("status") || undefined;
    const employmentType = searchParams.get("employmentType") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const year = searchParams.get("year");

    const where: Prisma.FielderPaymentWhereInput = {};
    if (fielderId) where.fielderId = fielderId;
    if (status) where.status = status as Prisma.EnumPaymentStatusFilter["equals"];
    if (employmentType === "contractor_1099" || employmentType === "w2") {
      where.employmentType = employmentType;
    }

    if (year) {
      const y = Number(year);
      if (Number.isFinite(y)) {
        where.OR = [
          { paidAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } },
          {
            AND: [
              { paidAt: null },
              { createdAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } },
            ],
          },
        ];
      }
    } else if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const payments = await prisma.fielderPayment.findMany({
      where,
      orderBy: [{ fielder: { lastName: "asc" } }, { createdAt: "desc" }],
      include: { fielder: true, project: true },
    });

    const header = [
      "Fielder",
      "Email",
      "Employment",
      "Project",
      "Status",
      "SQFT Amount",
      "Extras",
      "Total Owed",
      "Amount Paid",
      "Remaining",
      "Paid At",
      "Reference",
      "Created At",
    ];

    const lines = [
      header.join(","),
      ...payments.map((p) => {
        const total = toNumber(p.totalAmount);
        const paid = toNumber(p.amountPaid);
        return [
          csvEscape(`${p.fielder.firstName} ${p.fielder.lastName}`),
          csvEscape(p.fielder.email),
          csvEscape(p.employmentType === "w2" ? "W-2" : "1099"),
          csvEscape(p.project?.projectNumber),
          csvEscape(p.status),
          csvEscape(toNumber(p.sqftAmount).toFixed(2)),
          csvEscape(toNumber(p.lineItemsTotal).toFixed(2)),
          csvEscape(total.toFixed(2)),
          csvEscape(paid.toFixed(2)),
          csvEscape(Math.max(0, total - paid).toFixed(2)),
          csvEscape(p.paidAt ? p.paidAt.toISOString().slice(0, 10) : ""),
          csvEscape(p.referenceNumber),
          csvEscape(p.createdAt.toISOString().slice(0, 10)),
        ].join(",");
      }),
    ];

    const filename = `fielder-payments-${year || "export"}.csv`;
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
