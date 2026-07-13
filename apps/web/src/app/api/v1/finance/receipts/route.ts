import { NextRequest } from "next/server";
import {
  ALLOWED_RECEIPT_MIMES,
  MAX_RECEIPT_SIZE,
  hasPermission,
} from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { saveFile, computeFileHash } from "@/lib/storage";
import {
  loadReceiptNamingContext,
  prepareReceiptNames,
  serializeReceiptForClient,
} from "@/lib/receipt-upload";

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const { searchParams } = request.nextUrl;

    const where: {
      deletedAt: null;
      transactionId?: string;
      verificationStatus?: "pending" | "verified" | "rejected";
      transaction?: { fielderId?: string };
    } = {
      deletedAt: null,
    };

    const transactionId = searchParams.get("transactionId");
    if (transactionId) where.transactionId = transactionId;

    const fielderId = searchParams.get("fielderId");
    if (fielderId) where.transaction = { fielderId };

    const status = searchParams.get("status");
    if (status && ["pending", "verified", "rejected"].includes(status)) {
      where.verificationStatus = status as "pending" | "verified" | "rejected";
    }

    const receipts = await prisma.receipt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        transaction: {
          select: {
            id: true,
            amount: true,
            description: true,
            expenseStatus: true,
            transactionDate: true,
            project: { select: { projectNumber: true } },
            fielder: { select: { id: true, firstName: true, lastName: true } },
            category: { select: { name: true } },
          },
        },
      },
    });

    return jsonOk(receipts.map((receipt) => serializeReceiptForClient(receipt)));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return jsonError("Unauthorized", 401);

    const canUpload =
      hasPermission(user.role, "finance:write") ||
      hasPermission(user.role, "finance:admin") ||
      hasPermission(user.role, "receipt:self:upload");
    if (!canUpload) return jsonError("Forbidden", 403);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return jsonError("File required", 400);

    if (!ALLOWED_RECEIPT_MIMES.includes(file.type)) {
      return jsonError(`Invalid file type. Allowed: ${ALLOWED_RECEIPT_MIMES.join(", ")}`, 400);
    }

    if (file.size > MAX_RECEIPT_SIZE) {
      return jsonError(`File too large. Max size: ${MAX_RECEIPT_SIZE / 1024 / 1024}MB`, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = computeFileHash(buffer);

    const duplicate = await prisma.receipt.findFirst({
      where: { fileHash, deletedAt: null },
    });
    if (duplicate) {
      return jsonError("Duplicate receipt already uploaded", 409);
    }

    const transactionId = formData.get("transactionId")?.toString() || null;
    const projectId = formData.get("projectId")?.toString() || null;
    const vendorId = formData.get("vendorId")?.toString() || null;

    const namingContext = await loadReceiptNamingContext(transactionId, projectId);
    const { displayName, relativePath } = prepareReceiptNames(namingContext, file.name);

    const stored = await saveFile(buffer, file.name, file.type, {
      relativePath,
      displayName,
    });

    let resolvedProjectId = projectId;
    if (!resolvedProjectId && transactionId) {
      const tx = await prisma.financialTransaction.findUnique({
        where: { id: transactionId },
        select: { projectId: true },
      });
      resolvedProjectId = tx?.projectId ?? null;
    }

    const receipt = await prisma.receipt.create({
      data: {
        transactionId,
        originalFileName: displayName,
        storedFileName: stored.fileKey,
        mimeType: file.type,
        fileSize: file.size,
        storageProvider: stored.storageProvider,
        storageFileId: stored.storageFileId ?? null,
        storageUrl: stored.url,
        fileHash,
        projectId: resolvedProjectId,
        vendorId,
        uploadedById: user.id,
      },
      include: {
        uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        transaction: {
          select: {
            id: true,
            amount: true,
            description: true,
            expenseStatus: true,
            transactionDate: true,
            project: { select: { projectNumber: true } },
            fielder: { select: { id: true, firstName: true, lastName: true } },
            category: { select: { name: true } },
          },
        },
      },
    });

    await logFinanceAudit("uploaded", "receipt", receipt.id, { user, request }, undefined, receipt);

    return jsonOk(serializeReceiptForClient(receipt), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
