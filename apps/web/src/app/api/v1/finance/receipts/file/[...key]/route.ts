import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, requireUser } from "@/lib/api";
import { requireFinanceRead } from "@/lib/finance-auth";
import { readFile } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const user = requireUser(await getRequestUser(request));
    const { key } = await params;
    const storedFileName = key.map(decodeURIComponent).join("/");

    const receipt = await prisma.receipt.findFirst({
      where: { storedFileName, deletedAt: null },
      include: { transaction: { select: { fielderId: true } } },
    });
    if (!receipt) return jsonError("Receipt not found", 404);

    if (user.role === "fielder") {
      if (receipt.transaction?.fielderId !== user.fielderId) {
        return jsonError("Forbidden", 403);
      }
    } else {
      requireFinanceRead(user);
    }

    const buffer = await readFile(receipt.storedFileName, receipt.storageFileId);
    if (!buffer) return jsonError("File not found", 404);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": receipt.mimeType,
        "Content-Disposition": `inline; filename="${receipt.originalFileName}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
