import { NextRequest } from "next/server";
import { assignmentSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser } from "@/lib/api";
import { assignFielderToProject } from "@/lib/assignments";
import { serializeProject } from "@/lib/projects";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireOfficeUser(await getRequestUser(request));
    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { assignments: true },
    });
    if (!project) return jsonError("Project not found", 404);

    const body = await request.json();
    const parsed = assignmentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const assignment = await assignFielderToProject(projectId, parsed.data);

    return jsonOk(serializeProject(assignment), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
