import { NextRequest } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, requireUser } from "@/lib/api";
import { getFielderStatement } from "@/lib/statement";
import { generateStatementPdf } from "@/lib/statement-pdf";

export async function GET(request: NextRequest) {
  try {
    const user = requireUser(await getRequestUser(request));
    if (user.role !== "fielder" || !user.fielderId) {
      return jsonError("Forbidden", 403);
    }

    const month = request.nextUrl.searchParams.get("month") ?? undefined;
    const statement = await getFielderStatement(user.fielderId, month);
    if (!statement) return jsonError("Statement not found", 404);

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
