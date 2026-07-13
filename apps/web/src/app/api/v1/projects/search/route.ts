import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, isOfficeRole } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireUser } from "@/lib/api";
import {
  buildProjectSearchWhere,
  mapProjectToSearchResult,
} from "@/lib/project-search";

export async function GET(request: NextRequest) {
  try {
    const user = requireUser(await getRequestUser(request));
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (q.length < 2) {
      return jsonError("Enter at least 2 characters to search", 400);
    }

    const searchWhere = buildProjectSearchWhere(q);

    if (user.role === "fielder") {
      if (!user.fielderId) return jsonError("Forbidden", 403);

      const assignments = await prisma.assignment.findMany({
        where: {
          fielderId: user.fielderId,
          project: searchWhere,
        },
        orderBy: { assignedAt: "desc" },
        take: 25,
        include: {
          project: {
            include: {
              client: true,
              assignments: { include: { fielder: true } },
            },
          },
        },
      });

      return jsonOk({
        results: assignments.map((assignment) =>
          mapProjectToSearchResult(assignment.project, assignment.id)
        ),
      });
    }

    if (!isOfficeRole(user.role)) {
      return jsonError("Forbidden", 403);
    }

    const projects = await prisma.project.findMany({
      where: searchWhere,
      orderBy: { updatedAt: "desc" },
      take: 25,
      include: {
        client: true,
        assignments: { include: { fielder: true } },
      },
    });

    return jsonOk({
      results: projects.map((project) => mapProjectToSearchResult(project)),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
