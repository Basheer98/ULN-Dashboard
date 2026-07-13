import { NextRequest } from "next/server";
import { parseDateRangeParams } from "@uln/shared";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { requireFinanceRead } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import {
  generateFinanceReport,
  financeReportToCsv,
  FINANCE_REPORT_TYPES,
  type FinanceReportType,
} from "@/lib/finance-reports";

export async function GET(request: NextRequest) {
  try {
    const user = requireFinanceRead(await getRequestUser(request));
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type");

    if (!type || !FINANCE_REPORT_TYPES.includes(type as FinanceReportType)) {
      return jsonError(`Valid type param required. Options: ${FINANCE_REPORT_TYPES.join(", ")}`, 400);
    }

    const range = parseDateRangeParams(searchParams);
    const data = await generateFinanceReport(type as FinanceReportType, range);
    const csv = financeReportToCsv(type as FinanceReportType, data);

    await logFinanceAudit("exported", "report_csv", type, { user, request }, undefined, { type, range });

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="finance-${type}-report.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
