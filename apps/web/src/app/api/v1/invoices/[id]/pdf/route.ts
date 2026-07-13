import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, requirePermission } from "@/lib/api";
import { generateInvoicePdf } from "@/lib/pdf";
import { toNumber } from "@uln/shared";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePermission(await getRequestUser(request), "invoices:read");
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        project: { include: { lineItems: { where: { type: "client_billing" } } } },
      },
    });
    if (!invoice) return jsonError("Invoice not found", 404);

    const pdf = generateInvoicePdf({
      ...invoice,
      lineItems: invoice.project.lineItems.map((l) => ({
        description: l.description,
        amount: l.amount,
      })),
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
