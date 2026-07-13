import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, requireUser } from "@/lib/api";
import { readFile } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const user = await getRequestUser(request);
    if (!user) return jsonError("Unauthorized", 401);

    const { key } = await params;
    const attachment = await prisma.attachment.findFirst({ where: { fileKey: key } });
    if (!attachment) return jsonError("File not found", 404);

    const buffer = await readFile(key);
    if (!buffer) return jsonError("File not found", 404);

    return new Response(new Uint8Array(buffer), {
      headers: { "Content-Type": attachment.mimeType },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
