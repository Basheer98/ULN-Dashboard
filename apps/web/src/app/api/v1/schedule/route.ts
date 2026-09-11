import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonOk, requirePermission } from "@/lib/api";
import { serializeProject } from "@/lib/projects";

export async function GET(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "schedule:read");
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const fromDate = from ? new Date(from) : new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    const toDate = to ? new Date(to) : new Date();
    toDate.setDate(toDate.getDate() + 30);

    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        dueDate: { gte: fromDate, lte: toDate },
        status: { notIn: ["cancelled", "paid"] },
      },
      include: {
        client: true,
        assignments: { include: { fielder: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    return jsonOk(serializeProject(projects));
  } catch (error) {
    return handleApiError(error);
  }
}
