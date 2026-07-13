import { NextRequest } from "next/server";
import { projectSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser } from "@/lib/api";
import { getProjectFinancials, serializeProject } from "@/lib/projects";
import { z } from "zod";

const patchSchema = projectSchema.partial().extend({
  status: z.enum([
    "draft",
    "assigned",
    "in_progress",
    "complete",
    "invoiced",
    "paid",
    "cancelled",
  ]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireOfficeUser(await getRequestUser(request));
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        assignments: { include: { fielder: true } },
        lineItems: { include: { fielder: true } },
      },
    });

    if (!project) return jsonError("Project not found", 404);

    const financials = await getProjectFinancials(id);
    return jsonOk({ ...serializeProject(project), financials });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireOfficeUser(await getRequestUser(request));
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.dueDate !== undefined) {
      data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    }
    if (parsed.data.status === "complete") {
      data.completedAt = new Date();
    }

    const project = await prisma.project.update({
      where: { id },
      data,
      include: { client: true, assignments: true, lineItems: true },
    });

    return jsonOk(serializeProject(project));
  } catch (error) {
    return handleApiError(error);
  }
}
