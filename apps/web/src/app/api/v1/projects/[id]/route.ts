import { NextRequest } from "next/server";
import { projectSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser, requirePermission } from "@/lib/api";
import {
  getProjectFinancials,
  projectFieldChanges,
  serializeProject,
  softDeleteProject,
} from "@/lib/projects";
import { logActivity } from "@/lib/activity-log";
import { z } from "zod";

const patchSchema = projectSchema.partial().extend({
  status: z
    .enum([
      "draft",
      "assigned",
      "in_progress",
      "complete",
      "invoiced",
      "paid",
      "cancelled",
    ])
    .optional(),
});

const AUDIT_FIELDS = [
  "projectNumber",
  "clientId",
  "title",
  "siteAddress",
  "city",
  "state",
  "zip",
  "jobType",
  "qfield",
  "description",
  "sqft",
  "buriedSqft",
  "aerialSqft",
  "clientSqftRate",
  "status",
  "dueDate",
  "notes",
] as const;

function snapshot(project: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of AUDIT_FIELDS) {
    const val = project[key];
    out[key] =
      val instanceof Date
        ? val.toISOString()
        : val !== null && typeof val === "object" && "toFixed" in val
          ? Number(val)
          : val;
  }
  return out;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireOfficeUser(await getRequestUser(request));
    const { id } = await params;

    const project = await prisma.project.findFirst({
      where: { id, deletedAt: null },
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
    const user = requirePermission(await getRequestUser(request), "projects:write");
    const { id } = await params;
    const existing = await prisma.project.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) return jsonError("Project not found", 404);

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    if (parsed.data.projectNumber) {
      const conflict = await prisma.project.findFirst({
        where: {
          projectNumber: parsed.data.projectNumber.trim(),
          id: { not: id },
        },
      });
      if (conflict) {
        return jsonError(`Project number ${parsed.data.projectNumber} already exists`, 400);
      }
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.projectNumber !== undefined) {
      data.projectNumber = parsed.data.projectNumber.trim();
    }
    if (parsed.data.dueDate !== undefined) {
      data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    }
    if (parsed.data.buriedSqft !== undefined) {
      data.buriedSqft = parsed.data.buriedSqft == null ? null : parsed.data.buriedSqft;
    }
    if (parsed.data.aerialSqft !== undefined) {
      data.aerialSqft = parsed.data.aerialSqft == null ? null : parsed.data.aerialSqft;
    }
    if (parsed.data.status === "complete" && existing.status !== "complete") {
      data.completedAt = new Date();
    }

    const before = snapshot(existing as unknown as Record<string, unknown>);

    const project = await prisma.project.update({
      where: { id },
      data,
      include: { client: true, assignments: true, lineItems: true },
    });

    const after = snapshot(project as unknown as Record<string, unknown>);
    const changes = projectFieldChanges(before, after);

    if (Object.keys(changes).length > 0) {
      await logActivity({
        entityType: "project",
        entityId: id,
        action: "updated",
        user,
        summary: `Updated by ${user.email}`,
        metadata: {
          projectNumber: project.projectNumber,
          changes,
        },
      });
    }

    if (parsed.data.status) {
      try {
        const { syncSingleProjectToGoogleSheet } = await import("@/lib/sheet-writeback");
        await syncSingleProjectToGoogleSheet(id);
      } catch {
        // Best-effort — never block project updates on Sheets failures
      }
    }

    const becameComplete =
      parsed.data.status === "complete" && existing.status !== "complete";
    const becameInvoiced =
      parsed.data.status === "invoiced" && existing.status !== "invoiced";
    if (becameComplete || becameInvoiced) {
      try {
        const { createPaymentsFromProject } = await import("@/lib/finance");
        await createPaymentsFromProject(id);
      } catch {
        // Best-effort — payments can still be generated manually
      }
    }

    return jsonOk(serializeProject(project));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requirePermission(await getRequestUser(request), "projects:write");
    const { id } = await params;

    const result = await softDeleteProject(id, user, request);
    if (!result) return jsonError("Project not found", 404);

    return jsonOk({
      id,
      deletedAt: result.deletedAt,
      softDeletedExpenseCount: result.expenseIds.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
