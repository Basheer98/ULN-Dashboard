import { NextRequest } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { getFielderStatement } from "@/lib/statement";
import { generateStatementPdf } from "@/lib/statement-pdf";
import { sendEmail } from "@/lib/email";
import { formatCurrency } from "@uln/shared";

function rangeFromSearch(searchParams: URLSearchParams) {
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  if (from && to) return { from, to };
  const month = searchParams.get("month") ?? undefined;
  return month;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePermission(await getRequestUser(request), "payments:write");
    const { id } = await params;
    const range = rangeFromSearch(request.nextUrl.searchParams);

    const statement = await getFielderStatement(id, range);
    if (!statement) return jsonError("Fielder not found", 404);
    if (!statement.fielder.email) {
      return jsonError("Fielder has no email on file", 400);
    }

    const pdf = generateStatementPdf(statement);
    const filename = `${statement.fielder.lastName}-statement.pdf`;
    const result = await sendEmail({
      to: statement.fielder.email,
      subject: `ULN payment statement — ${statement.monthLabel}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px">
          <p>Hi ${statement.fielder.firstName},</p>
          <p>Attached is your Urbanlink Networks payment statement for <strong>${statement.monthLabel}</strong>.</p>
          <p>
            Earned: ${formatCurrency(statement.totals.total)} ·
            Paid: ${formatCurrency(statement.totals.paid)} ·
            Remaining: ${formatCurrency(statement.totals.pending)}
          </p>
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

    return jsonOk({
      sent: result.ok,
      skipped: "skipped" in result ? result.skipped : false,
      to: statement.fielder.email,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
