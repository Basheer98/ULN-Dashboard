import { NextRequest } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { requireFinanceRead } from "@/lib/finance-auth";
import { getFinanceDashboardStats } from "@/lib/finance-transactions";

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const { searchParams } = request.nextUrl;

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const startDate = from ? new Date(from) : undefined;
    const endDate = to ? new Date(to) : undefined;

    const stats = await getFinanceDashboardStats(startDate, endDate);

    return jsonOk(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
