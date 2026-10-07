import { NextRequest } from "next/server";
import {
  canViewProjectFinancials,
  hasPermission,
  PROJECT_ENTRY_STATUSES,
  projectCreateSchema,
} from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission, requireProjectEntry } from "@/lib/api";
import { assignFielderToProject } from "@/lib/assignments";
import { activeProjectWhere, serializeProject, stripProjectMoney } from "@/lib/projects";
import { logActivity } from "@/lib/activity-log";
import { resolveFielderRateForAssignment, resolveRatesForProject } from "@/lib/rates";

export async function GET(request: NextRequest) {
  try {
    const user = requirePermission(await getRequestUser(request), "projects:read");

    const projects = await prisma.project.findMany({
      where: activeProjectWhere,
      orderBy: { createdAt: "desc" },
      include: {
        client: true,
        assignments: { include: { fielder: true } },
        lineItems: true,
      },
    });

    const serialized = serializeProject(projects);
    if (!canViewProjectFinancials(user.role)) {
      return jsonOk(stripProjectMoney(serialized));
    }
    return jsonOk(serialized);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireProjectEntry(await getRequestUser(request));
    const canSeeMoney = canViewProjectFinancials(user.role);
    const canManage = hasPermission(user.role, "projects:write");

    const body = await request.json();
    const parsed = projectCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }
    if (!canManage) {
      if (parsed.data.assignment) {
        return jsonError("You don't have permission to assign fielders", 403);
      }
      const status = parsed.data.status;
      if (status && !(PROJECT_ENTRY_STATUSES as readonly string[]).includes(status)) {
        return jsonError("You can't set that status", 403);
      }
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

    let clientSqftRate = projectData.clientSqftRate;
    if (clientSqftRate === undefined || !canSeeMoney) {
      const rates = await resolveRatesForProject(projectData.clientId, projectData.state);
      clientSqftRate = rates.client.clientSqftRate;
    }

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
        clientSqftRate,
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
        let fielderSqftRate = assignment.fielderSqftRate;
        if (fielderSqftRate === undefined || !canSeeMoney) {
          const fr = await resolveFielderRateForAssignment(
            assignment.fielderId,
            project.state
          );
          fielderSqftRate = fr.fielderSqftRate;
        }
        await assignFielderToProject(project.id, {
          ...assignment,
          fielderSqftRate,
        });
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

      const serialized = serializeProject(withAssignment!);
      return jsonOk(canSeeMoney ? serialized : stripProjectMoney(serialized), 201);
    }

    const serialized = serializeProject(project);
    return jsonOk(canSeeMoney ? serialized : stripProjectMoney(serialized), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
