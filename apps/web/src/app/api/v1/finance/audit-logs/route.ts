import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonOk } from "@/lib/api";
import { requireFinanceRead } from "@/lib/finance-auth";

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const { searchParams } = request.nextUrl;

    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const logs = await prisma.financialAuditLog.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    const total = await prisma.financialAuditLog.count({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
    });

    return jsonOk({ logs, total, limit, offset });
  } catch (error) {
    return handleApiError(error);
  }
}
