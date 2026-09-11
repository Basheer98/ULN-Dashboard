import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { restoreProject, serializeProject } from "@/lib/projects";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requirePermission(await getRequestUser(request), "projects:write");
    const { id } = await params;

    const result = await restoreProject(id, user, request);
    if (!result) return jsonError("Deleted project not found", 404);

    const project = await prisma.project.findUnique({
      where: { id },
      include: { client: true, assignments: true, lineItems: true },
    });

    return jsonOk(serializeProject(project));
  } catch (error) {
    return handleApiError(error);
  }
}
