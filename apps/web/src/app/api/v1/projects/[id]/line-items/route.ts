import { NextRequest } from "next/server";
import { lineItemSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { serializeProject } from "@/lib/projects";
import { logActivity } from "@/lib/activity-log";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requirePermission(await getRequestUser(request), "projects:write");
    const { id: projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) return jsonError("Project not found", 404);

    const body = await request.json();
    const parsed = lineItemSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const lineItem = await prisma.projectLineItem.create({
      data: {
        projectId,
        type: parsed.data.type,
        description: parsed.data.description,
        amount: parsed.data.amount,
        fielderId: parsed.data.fielderId || null,
      },
    });

    await logActivity({
      entityType: "project",
      entityId: projectId,
      action: "updated",
      user,
      summary: `Line item added by ${user.email}`,
      metadata: {
        lineItemId: lineItem.id,
        description: lineItem.description,
        amount: Number(lineItem.amount),
      },
    });

    return jsonOk(serializeProject(lineItem), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
