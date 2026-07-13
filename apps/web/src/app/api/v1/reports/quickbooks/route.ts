import { NextRequest } from "next/server";
import { parseDateRangeParams } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, requirePermission } from "@/lib/api";
import { quickbooksInvoicesCsv, quickbooksPaymentsCsv, taxSummaryCsv } from "@/lib/export";
import { inDateRange } from "@uln/shared";

export async function GET(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "reports:export");
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type") ?? "invoices";
    const range = parseDateRangeParams(searchParams);

    if (type === "payments" || type === "tax") {
      const payments = await prisma.fielderPayment.findMany({
        where: { status: "paid" },
        include: { fielder: true, project: true },
      });
      const filtered = payments.filter((p) =>
        inDateRange(new Date(p.paidAt ?? p.createdAt), range)
      );
      const csv = type === "tax" ? taxSummaryCsv(filtered) : quickbooksPaymentsCsv(filtered);
      const filename = type === "tax" ? "1099-w2-summary.csv" : "quickbooks-payments.csv";
      return new Response(csv, {
        headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${filename}"` },
      });
    }

    const invoices = await prisma.invoice.findMany({
      include: { client: true },
      where: { status: { not: "draft" } },
    });
    const filtered = invoices.filter((i) =>
      inDateRange(new Date(i.issuedAt ?? i.createdAt), range)
    );
    const csv = quickbooksInvoicesCsv(filtered);
    return new Response(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="quickbooks-invoices.csv"' },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
