import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireUser } from "@/lib/api";
import { saveFile } from "@/lib/storage";
import { serializeProject } from "@/lib/projects";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireUser(await getRequestUser(request));
    const { id: projectId } = await params;
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
    const user = requireUser(await getRequestUser(request));
    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return jsonError("Project not found", 404);

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
