import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { requireFinanceRead } from "@/lib/finance-auth";
import { getProjectProfitability } from "@/lib/finance-transactions";

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));

    const projects = await prisma.project.findMany({
      where: { deletedAt: null, status: { not: "cancelled" } },
      select: { id: true, projectNumber: true, title: true, status: true },
      orderBy: { projectNumber: "desc" },
    });

    const summaries = await Promise.all(
      projects.map(async (p) => {
        const data = await getProjectProfitability(p.id);
        return {
          projectId: p.id,
          projectNumber: p.projectNumber,
          title: p.title,
          status: p.status,
          revenue: data.revenue,
          directExpenses: data.directExpenses,
          allocatedExpenses: data.allocatedExpenses,
          totalExpenses: data.totalExpenses,
          profit: data.profit,
          margin: data.margin,
        };
      })
    );

    return jsonOk(summaries);
  } catch (error) {
    return handleApiError(error);
  }
}
