import { NextRequest } from "next/server";
import {
  ALLOWED_RECEIPT_MIMES,
  MAX_RECEIPT_SIZE,
  hasPermission,
} from "@uln/shared";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { scanReceiptImage } from "@/lib/receipt-ocr";
import { suggestExpenseFields } from "@/lib/expense-smart-service";
import { prisma } from "@/lib/prisma";
import { saveFile, computeFileHash } from "@/lib/storage";
import {
  loadReceiptNamingContext,
  prepareReceiptNames,
  serializeReceiptForClient,
} from "@/lib/receipt-upload";
import { logFinanceAudit } from "@/lib/finance-audit";

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

    const projectId = formData.get("projectId")?.toString() || null;
    const vendorId = formData.get("vendorId")?.toString() || null;
    const fielderId =
      user.role === "fielder" && user.fielderId
        ? user.fielderId
        : formData.get("fielderId")?.toString() || null;

    const [ocr, namingContext] = await Promise.all([
      scanReceiptImage(buffer),
      loadReceiptNamingContext(null, projectId),
    ]);
    const { displayName, relativePath } = prepareReceiptNames(namingContext, file.name);
    const stored = await saveFile(buffer, file.name, file.type, {
      relativePath,
      displayName,
    });

    const receipt = await prisma.receipt.create({
      data: {
        transactionId: null,
        originalFileName: displayName,
        storedFileName: stored.fileKey,
        mimeType: file.type,
        fileSize: file.size,
        storageProvider: stored.storageProvider,
        storageFileId: stored.storageFileId ?? null,
        storageUrl: stored.url,
        fileHash,
        projectId,
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

    const suggestions = await suggestExpenseFields({
      description: ocr.vendorName,
      vendorName: ocr.vendorName,
      vendorId,
      fielderId,
      amount: ocr.amount ?? undefined,
      transactionDate: ocr.transactionDate ?? new Date().toISOString().slice(0, 10),
    });

    return jsonOk(
      {
        receipt: serializeReceiptForClient(receipt),
        ocr,
        suggestions,
        ocrOk: ocr.ok,
        ocrError: ocr.error,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
