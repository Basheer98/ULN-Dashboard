import { NextRequest } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, requirePermission } from "@/lib/api";
import { getFielderStatement } from "@/lib/statement";
import { generateStatementPdf } from "@/lib/statement-pdf";

function rangeFromSearch(searchParams: URLSearchParams) {
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  if (from && to) return { from, to };
  const month = searchParams.get("month") ?? undefined;
  return month;
}

function fileLabel(month?: string | null, from?: string | null, to?: string | null) {
  if (from && to) return `${from}_to_${to}`;
  return month ?? "current";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePermission(await getRequestUser(request), "payments:read");
    const { id } = await params;
    const range = rangeFromSearch(request.nextUrl.searchParams);

    const statement = await getFielderStatement(id, range);
    if (!statement) return jsonError("Fielder not found", 404);

    const pdf = generateStatementPdf(statement);
    const name = `${statement.fielder.lastName}-statement-${fileLabel(
      request.nextUrl.searchParams.get("month"),
      request.nextUrl.searchParams.get("from"),
      request.nextUrl.searchParams.get("to")
    )}.pdf`;

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
