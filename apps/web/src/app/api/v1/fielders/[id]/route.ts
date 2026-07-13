import { NextRequest } from "next/server";
import { fielderSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser } from "@/lib/api";
import { serializeProject } from "@/lib/projects";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireOfficeUser(await getRequestUser(request));
    const { id } = await params;

    const fielder = await prisma.fielder.findUnique({
      where: { id },
      include: { user: true, assignments: { include: { project: true } } },
    });

    if (!fielder) return jsonError("Fielder not found", 404);
    return jsonOk(serializeProject(fielder));
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
    const parsed = fielderSchema.partial().safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const fielder = await prisma.fielder.update({
      where: { id },
      data: parsed.data,
    });

    return jsonOk(serializeProject(fielder));
  } catch (error) {
    return handleApiError(error);
  }
}
