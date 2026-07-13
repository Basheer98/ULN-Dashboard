import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireUser } from "@/lib/api";
import { serializeProject } from "@/lib/projects";

export async function GET(request: NextRequest) {
  try {
    const user = requireUser(await getRequestUser(request));
    if (user.role !== "fielder" || !user.fielderId) {
      return jsonError("Forbidden", 403);
    }

    const assignments = await prisma.assignment.findMany({
      where: { fielderId: user.fielderId },
      orderBy: { assignedAt: "desc" },
      include: {
        project: { include: { client: true } },
      },
    });

    return jsonOk(serializeProject(assignments));
  } catch (error) {
    return handleApiError(error);
  }
}
