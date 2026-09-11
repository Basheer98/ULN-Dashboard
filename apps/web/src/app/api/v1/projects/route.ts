import { NextRequest } from "next/server";
import { projectCreateSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser, requirePermission } from "@/lib/api";
import { assignFielderToProject } from "@/lib/assignments";
import { activeProjectWhere, serializeProject } from "@/lib/projects";
import { logActivity } from "@/lib/activity-log";

export async function GET(request: NextRequest) {
  try {
    requireOfficeUser(await getRequestUser(request));

    const projects = await prisma.project.findMany({
      where: activeProjectWhere,
      orderBy: { createdAt: "desc" },
      include: {
        client: true,
        assignments: { include: { fielder: true } },
        lineItems: true,
      },
    });

    return jsonOk(serializeProject(projects));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requirePermission(await getRequestUser(request), "projects:write");

    const body = await request.json();
    const parsed = projectCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const projectNumber = parsed.data.projectNumber.trim();
    const existing = await prisma.project.findUnique({ where: { projectNumber } });
    if (existing && !existing.deletedAt) {
      return jsonError(`Project number ${projectNumber} already exists`, 400);
    }
    if (existing?.deletedAt) {
      return jsonError(
        `Project number ${projectNumber} belongs to a deleted project. Restore it or use a different number.`,
        400
      );
    }

    const { assignment, ...projectData } = parsed.data;

    const project = await prisma.project.create({
      data: {
        projectNumber,
        clientId: projectData.clientId,
        title: projectData.title,
        siteAddress: projectData.siteAddress,
        city: projectData.city,
        state: projectData.state,
        zip: projectData.zip,
        jobType: projectData.jobType,
        qfield: projectData.qfield ?? null,
        description: projectData.description,
        sqft: projectData.sqft,
        buriedSqft: projectData.buriedSqft ?? null,
        aerialSqft: projectData.aerialSqft ?? null,
        clientSqftRate: projectData.clientSqftRate,
        status: assignment ? "assigned" : projectData.status ?? "draft",
        dueDate: projectData.dueDate ? new Date(projectData.dueDate) : null,
        notes: projectData.notes,
        createdById: user.id,
      },
      include: { client: true, assignments: { include: { fielder: true } } },
    });

    await logActivity({
      entityType: "project",
      entityId: project.id,
      action: "created",
      user,
      summary: `Created by ${user.email}`,
      metadata: {
        projectNumber: project.projectNumber,
        title: project.title,
      },
    });

    if (assignment) {
      try {
        await assignFielderToProject(project.id, assignment);
        await logActivity({
          entityType: "project",
          entityId: project.id,
          action: "updated",
          user,
          summary: `Fielder assigned by ${user.email}`,
          metadata: { fielderId: assignment.fielderId },
        });
      } catch (err) {
        await prisma.project.delete({ where: { id: project.id } });
        throw err;
      }

      const withAssignment = await prisma.project.findUnique({
        where: { id: project.id },
        include: { client: true, assignments: { include: { fielder: true } } },
      });

      return jsonOk(serializeProject(withAssignment!), 201);
    }

    return jsonOk(serializeProject(project), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
