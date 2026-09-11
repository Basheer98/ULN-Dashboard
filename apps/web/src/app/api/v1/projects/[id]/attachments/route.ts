import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { assertCanAccessProjectFiles, requireAuthUser } from "@/lib/finance-auth";
import { saveFile } from "@/lib/storage";
import { serializeProject } from "@/lib/projects";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuthUser(await getRequestUser(request));
    const { id: projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) return jsonError("Project not found", 404);
    await assertCanAccessProjectFiles(user, projectId);

    const attachments = await prisma.attachment.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(serializeProject(attachments));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireAuthUser(await getRequestUser(request));
    const { id: projectId } = await params;

    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) return jsonError("Project not found", 404);
    await assertCanAccessProjectFiles(user, projectId);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return jsonError("No file provided", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const { fileKey, url } = await saveFile(buffer, file.name, file.type || "image/jpeg");

    const attachment = await prisma.attachment.create({
      data: {
        projectId,
        uploadedById: user.id,
        fileKey,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        size: buffer.length,
        type: "photo",
      },
    });

    return jsonOk(serializeProject({ ...attachment, url }), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
