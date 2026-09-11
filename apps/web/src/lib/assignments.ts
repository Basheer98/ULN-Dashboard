import type { AssignmentInput } from "@uln/shared";
import { toNumber } from "@uln/shared";
import { ApiError } from "./api";
import { prisma } from "./prisma";
import { notifyFielderAssignment } from "./push";

export async function assignFielderToProject(
  projectId: string,
  data: AssignmentInput
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: { assignments: true },
  });
  if (!project) throw new ApiError("Project not found", 404);

  const fielder = await prisma.fielder.findUnique({
    where: { id: data.fielderId },
    include: { user: true },
  });
  if (!fielder) throw new ApiError("Fielder not found", 404);

  const existing = await prisma.assignment.findUnique({
    where: { projectId_fielderId: { projectId, fielderId: data.fielderId } },
  });
  if (existing) throw new ApiError("Fielder already assigned to this project", 400);

  const projectSqft = toNumber(project.sqft);
  const assignedSqft =
    data.assignedSqft ?? (project.assignments.length === 0 ? projectSqft : 0);

  if (assignedSqft <= 0) {
    throw new ApiError(
      "assignedSqft is required when splitting across multiple fielders",
      400
    );
  }

  const assignment = await prisma.assignment.create({
    data: {
      projectId,
      fielderId: data.fielderId,
      fielderSqftRate: data.fielderSqftRate,
      assignedSqft,
      notes: data.notes,
      status: "assigned",
    },
    include: { fielder: true, project: { include: { client: true } } },
  });

  if (project.status === "draft") {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "assigned" },
    });
  }

  await notifyFielderAssignment(
    fielder.user?.pushToken,
    project.projectNumber,
    project.title,
    assignment.id
  );

  return assignment;
}
