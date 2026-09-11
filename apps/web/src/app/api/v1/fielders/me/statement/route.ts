import { NextRequest } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, requireUser } from "@/lib/api";
import { getFielderStatement } from "@/lib/statement";
import { generateStatementPdf } from "@/lib/statement-pdf";

function rangeFromSearch(searchParams: URLSearchParams) {
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  if (from && to) return { from, to };
  const month = searchParams.get("month") ?? undefined;
  return month;
}

export async function GET(request: NextRequest) {
  try {
    const user = requireUser(await getRequestUser(request));
    if (user.role !== "fielder" || !user.fielderId) {
      return jsonError("Forbidden", 403);
    }

    const range = rangeFromSearch(request.nextUrl.searchParams);
    const statement = await getFielderStatement(user.fielderId, range);
    if (!statement) return jsonError("Statement not found", 404);

    const pdf = generateStatementPdf(statement);
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    const month = request.nextUrl.searchParams.get("month");
    const label = from && to ? `${from}_to_${to}` : month ?? "current";
    const name = `${statement.fielder.lastName}-statement-${label}.pdf`;

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
