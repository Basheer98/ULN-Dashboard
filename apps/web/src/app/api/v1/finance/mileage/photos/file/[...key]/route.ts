import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError } from "@/lib/api";
import {
  canViewTransaction,
  requireAuthUser,
  requireFinanceRead,
} from "@/lib/finance-auth";
import { readFile } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const user = requireAuthUser(await getRequestUser(request));
    const { key } = await params;
    const storedFileName = key.map(decodeURIComponent).join("/");

    const photo = await prisma.mileagePhoto.findFirst({
      where: { storedFileName, deletedAt: null },
      include: {
        mileageEntry: { select: { driverId: true } },
        uploadedBy: { select: { fielderId: true } },
      },
    });
    if (!photo) return jsonError("Photo not found", 404);

    if (user.role === "fielder") {
      const owns =
        canViewTransaction(user, photo.mileageEntry?.driverId) ||
        photo.uploadedBy?.fielderId === user.fielderId ||
        photo.uploadedById === user.id;
      if (!owns) return jsonError("Forbidden", 403);
    } else {
      requireFinanceRead(user);
    }

    const buffer = await readFile(photo.storedFileName, photo.storageFileId);
    if (!buffer) return jsonError("File not found", 404);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": photo.mimeType,
        "Content-Disposition": `inline; filename="${photo.originalFileName}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
