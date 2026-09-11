import { NextRequest } from "next/server";
import { assignmentStatusSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireUser } from "@/lib/api";
import { serializeProject } from "@/lib/projects";
import {
  notifyOfficeJobAccepted,
  notifyOfficeJobCompleted,
  notifyOfficeJobStarted,
} from "@/lib/notifications";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireUser(await getRequestUser(request));
    const { id } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!assignment) return jsonError("Assignment not found", 404);

    const isFielder = user.role === "fielder" && user.fielderId === assignment.fielderId;
    const isOffice = user.role !== "fielder";
    if (!isFielder && !isOffice) {
      return jsonError("Forbidden", 403);
    }

    const body = await request.json();
    const parsed = assignmentStatusSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const now = new Date();
    const updateData: Record<string, unknown> = { status: parsed.data.status };

    if (parsed.data.status === "in_progress" && !assignment.startedAt) {
      updateData.startedAt = now;
    }
    if (parsed.data.status === "complete") {
      updateData.completedAt = now;
    }

    const previousStatus = assignment.status;

    const updated = await prisma.assignment.update({
      where: { id },
      data: updateData,
      include: { project: { include: { client: true } }, fielder: true },
    });

    if (parsed.data.status === "in_progress" && assignment.project.status === "assigned") {
      await prisma.project.update({
        where: { id: assignment.projectId },
        data: { status: "in_progress" },
      });
    }

    if (parsed.data.status === "complete") {
      const incomplete = await prisma.assignment.count({
        where: {
          projectId: assignment.projectId,
          status: { not: "complete" },
        },
      });
      if (incomplete === 0) {
        await prisma.project.update({
          where: { id: assignment.projectId },
          data: { status: "complete", completedAt: now },
        });
        try {
          const { createPaymentsFromProject } = await import("@/lib/finance");
          await createPaymentsFromProject(assignment.projectId);
        } catch {
          // Best-effort
        }
      }
    }

    if (isFielder) {
      const fielderName = `${updated.fielder.firstName} ${updated.fielder.lastName}`;
      const { projectNumber, title, id: projectId } = updated.project;

      if (parsed.data.status === "accepted" && previousStatus === "assigned") {
        await notifyOfficeJobAccepted(
          fielderName,
          projectNumber,
          title,
          projectId,
          updated.id
        );
      }

      if (parsed.data.status === "in_progress" && previousStatus !== "in_progress") {
        await notifyOfficeJobStarted(
          fielderName,
          projectNumber,
          title,
          projectId,
          updated.id
        );
      }

      if (parsed.data.status === "complete" && previousStatus !== "complete") {
        await notifyOfficeJobCompleted(
          fielderName,
          projectNumber,
          title,
          projectId,
          updated.id
        );
      }
    }

    if (
      parsed.data.status === "in_progress" ||
      parsed.data.status === "complete"
    ) {
      try {
        const { syncSingleProjectToGoogleSheet } = await import("@/lib/sheet-writeback");
        await syncSingleProjectToGoogleSheet(assignment.projectId);
      } catch {
        // Best-effort sheet sync
      }
    }

    return jsonOk(serializeProject(updated));
  } catch (error) {
    return handleApiError(error);
  }
}
