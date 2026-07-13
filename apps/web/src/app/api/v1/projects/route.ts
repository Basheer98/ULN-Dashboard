import { NextRequest } from "next/server";
import { projectCreateSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser } from "@/lib/api";
import { assignFielderToProject } from "@/lib/assignments";
import { serializeProject } from "@/lib/projects";

export async function GET(request: NextRequest) {
  try {
    requireOfficeUser(await getRequestUser(request));

    const projects = await prisma.project.findMany({
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
    const user = requireOfficeUser(await getRequestUser(request));

    const body = await request.json();
    const parsed = projectCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const projectNumber = parsed.data.projectNumber.trim();
    const existing = await prisma.project.findUnique({ where: { projectNumber } });
    if (existing) {
      return jsonError(`Project number ${projectNumber} already exists`, 400);
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
        clientSqftRate: projectData.clientSqftRate,
        status: assignment ? "assigned" : projectData.status ?? "draft",
        dueDate: projectData.dueDate ? new Date(projectData.dueDate) : null,
        notes: projectData.notes,
        createdById: user.id,
      },
      include: { client: true, assignments: { include: { fielder: true } } },
    });

    if (assignment) {
      try {
        await assignFielderToProject(project.id, assignment);
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
