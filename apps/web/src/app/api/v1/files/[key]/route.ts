import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import { assertCanAccessProjectFiles, requireAuthUser } from "@/lib/finance-auth";
import { readFile } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const user = requireAuthUser(await getRequestUser(request));
    const { key } = await params;
    const fileKey = decodeURIComponent(key);

    const attachment = await prisma.attachment.findFirst({ where: { fileKey } });
    if (!attachment) return jsonError("File not found", 404);

    await assertCanAccessProjectFiles(user, attachment.projectId);

    const buffer = await readFile(fileKey);
    if (!buffer) return jsonError("File not found", 404);

    return new Response(new Uint8Array(buffer), {
      headers: { "Content-Type": attachment.mimeType },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
