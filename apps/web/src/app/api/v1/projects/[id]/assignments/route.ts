import { NextRequest } from "next/server";
import { assignmentSchema, canViewProjectFinancials } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { assignFielderToProject } from "@/lib/assignments";
import { serializeProject, stripProjectMoney } from "@/lib/projects";
import { logActivity } from "@/lib/activity-log";
import { resolveFielderRateForAssignment } from "@/lib/rates";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requirePermission(await getRequestUser(request), "projects:write");
    const canSeeMoney = canViewProjectFinancials(user.role);
    const { id: projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      include: { assignments: true },
    });
    if (!project) return jsonError("Project not found", 404);

    const body = await request.json();
    const parsed = assignmentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    let fielderSqftRate = parsed.data.fielderSqftRate;
    if (fielderSqftRate === undefined || !canSeeMoney) {
      const fr = await resolveFielderRateForAssignment(
        parsed.data.fielderId,
        project.state
      );
      fielderSqftRate = fr.fielderSqftRate;
    }

    const assignment = await assignFielderToProject(projectId, {
      ...parsed.data,
      fielderSqftRate,
    });

    await logActivity({
      entityType: "project",
      entityId: projectId,
      action: "updated",
      user,
      summary: `Fielder assigned by ${user.email}`,
      metadata: { fielderId: parsed.data.fielderId },
    });

    const serialized = serializeProject(assignment);
    return jsonOk(canSeeMoney ? serialized : stripProjectMoney(serialized), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
