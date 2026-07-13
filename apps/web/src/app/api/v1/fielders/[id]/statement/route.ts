import { NextRequest } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, requirePermission } from "@/lib/api";
import { getFielderStatement } from "@/lib/statement";
import { generateStatementPdf } from "@/lib/statement-pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePermission(await getRequestUser(request), "payments:read");
    const { id } = await params;
    const month = request.nextUrl.searchParams.get("month") ?? undefined;

    const statement = await getFielderStatement(id, month);
    if (!statement) return jsonError("Fielder not found", 404);

    const pdf = generateStatementPdf(statement);
    const name = `${statement.fielder.lastName}-statement-${month ?? "current"}.pdf`;

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
