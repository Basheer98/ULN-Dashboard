import { NextRequest } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import {
  generateFinanceReport,
  FINANCE_REPORT_TYPES,
  type FinanceReportType,
} from "@/lib/finance-reports";
import { parseDateRangeParams } from "@uln/shared";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const user = requireFinanceRead(await getRequestUser(request));
    const { type } = await params;

    if (!FINANCE_REPORT_TYPES.includes(type as FinanceReportType)) {
      return jsonError(`Unknown report type: ${type}`, 400);
    }

    const range = parseDateRangeParams(request.nextUrl.searchParams);
    const data = await generateFinanceReport(type as FinanceReportType, range);

    await logFinanceAudit("exported", "report", type, { user, request }, undefined, { type, range });

    return jsonOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}
