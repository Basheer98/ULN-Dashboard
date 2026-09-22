import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { generateInvoicePdf } from "@/lib/pdf";
import { sendEmail } from "@/lib/email";
import { formatCurrency, toNumber } from "@uln/shared";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePermission(await getRequestUser(request), "invoices:write");
    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: true,
        project: { include: { lineItems: { where: { type: "client_billing" } } } },
      },
    });
    if (!invoice) return jsonError("Invoice not found", 404);

    const to = invoice.client.email?.trim();
    if (!to) {
      return jsonError("Client has no email on file", 400);
    }

    const pdf = generateInvoicePdf({
      ...invoice,
      lineItems: invoice.project.lineItems.map((l) => ({
        description: l.description,
        amount: l.amount,
      })),
    });

    const filename = `${invoice.invoiceNumber}.pdf`;
    const result = await sendEmail({
      to,
      subject: `Invoice ${invoice.invoiceNumber} — Urbanlink Networks`,
      html: `
        <div style="font-family:sans-serif;max-width:560px">
          <p>Hi ${invoice.client.contactName || invoice.client.name},</p>
          <p>
            Attached is invoice <strong>${invoice.invoiceNumber}</strong> for
            project <strong>${invoice.project.projectNumber} — ${invoice.project.title}</strong>.
          </p>
          <p>Amount due: <strong>${formatCurrency(toNumber(invoice.totalAmount))}</strong>
            ${invoice.dueAt ? ` · Due ${invoice.dueAt.toLocaleDateString()}` : ""}
          </p>
          <p>Thank you for your business.</p>
        </div>
      `,
      attachments: [
        {
          filename,
          content: pdf.toString("base64"),
          contentType: "application/pdf",
        },
      ],
    });

    if (!result.ok && !("skipped" in result && result.skipped)) {
      return jsonError("Failed to send email", 502);
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: invoice.status === "draft" || invoice.status === "sent" ? "sent" : invoice.status,
        issuedAt: invoice.issuedAt ?? new Date(),
      },
    });

    return jsonOk({
      sent: result.ok,
      skipped: "skipped" in result ? result.skipped : false,
      to,
      status: updated.status,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
