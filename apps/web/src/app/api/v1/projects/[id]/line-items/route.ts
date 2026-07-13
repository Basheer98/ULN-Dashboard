import { NextRequest } from "next/server";
import { lineItemSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser } from "@/lib/api";
import { serializeProject } from "@/lib/projects";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireOfficeUser(await getRequestUser(request));
    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
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

    return jsonOk(serializeProject(lineItem), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
