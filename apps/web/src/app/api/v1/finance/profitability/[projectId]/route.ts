import { NextRequest } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead } from "@/lib/finance-auth";
import { getProjectProfitability } from "@/lib/finance-transactions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const { projectId } = await params;

    try {
      const data = await getProjectProfitability(projectId);
      return jsonOk({
        projectId,
        projectNumber: data.project.projectNumber,
        title: data.project.title,
        client: data.project.client?.name ?? null,
        revenue: data.revenue,
        directExpenses: data.directExpenses,
        allocatedExpenses: data.allocatedExpenses,
        totalExpenses: data.totalExpenses,
        profit: data.profit,
        margin: data.margin,
      });
    } catch {
      return jsonError("Project not found", 404);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
