import crypto from "crypto";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  buildReceiptDisplayName,
  buildReceiptGalleryLabel,
  buildReceiptStoragePath,
  type ReceiptNamingContext,
} from "@/lib/receipt-naming";

export async function loadReceiptNamingContext(
  transactionId: string | null,
  projectId: string | null
): Promise<ReceiptNamingContext> {
  if (!transactionId) {
    if (!projectId) return { transactionDate: new Date() };
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { projectNumber: true },
    });
    return {
      transactionDate: new Date(),
      projectNumber: project?.projectNumber ?? null,
    };
  }

  const transaction = await prisma.financialTransaction.findUnique({
    where: { id: transactionId },
    include: {
      fielder: { select: { id: true, firstName: true, lastName: true } },
      project: { select: { projectNumber: true } },
      category: { select: { name: true } },
    },
  });

  if (!transaction) {
    return { transactionDate: new Date() };
  }

  return {
    transactionDate: transaction.transactionDate,
    fielderId: transaction.fielderId,
    fielderFirstName: transaction.fielder?.firstName ?? null,
    fielderLastName: transaction.fielder?.lastName ?? null,
    projectNumber: transaction.project?.projectNumber ?? null,
    amount: Number(transaction.amount),
    description: transaction.description,
    categoryName: transaction.category?.name ?? null,
  };
}

export function prepareReceiptNames(
  ctx: ReceiptNamingContext,
  originalFileName: string
) {
  const ext = path.extname(originalFileName) || ".jpg";
  const uniqueId = crypto.randomUUID();
  const displayName = buildReceiptDisplayName(ctx, ext);
  const relativePath = buildReceiptStoragePath(ctx, uniqueId, ext);
  const galleryLabel = buildReceiptGalleryLabel(ctx);

  return { displayName, relativePath, galleryLabel };
}

export function serializeReceiptForClient(receipt: {
  id: string;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  fileSize: number;
  verificationStatus: string;
  createdAt: Date;
  transactionId: string | null;
  transaction?: {
    amount: unknown;
    description: string | null;
    expenseStatus: string | null;
    transactionDate?: Date;
    project?: { projectNumber: string | null } | null;
    fielder?: { id: string; firstName: string; lastName: string } | null;
    category?: { name: string } | null;
  } | null;
}) {
  const ctx: ReceiptNamingContext = receipt.transaction
    ? {
        transactionDate: receipt.transaction.transactionDate ?? receipt.createdAt,
        fielderId: receipt.transaction.fielder?.id ?? null,
        fielderFirstName: receipt.transaction.fielder?.firstName ?? null,
        fielderLastName: receipt.transaction.fielder?.lastName ?? null,
        projectNumber: receipt.transaction.project?.projectNumber ?? null,
        amount: Number(receipt.transaction.amount),
        description: receipt.transaction.description,
        categoryName: receipt.transaction.category?.name ?? null,
      }
    : { transactionDate: receipt.createdAt };

  return {
    id: receipt.id,
    originalFileName: receipt.originalFileName,
    storedFileName: receipt.storedFileName,
    mimeType: receipt.mimeType,
    fileSize: receipt.fileSize,
    verificationStatus: receipt.verificationStatus,
    createdAt: receipt.createdAt,
    transactionId: receipt.transactionId,
    displayName: receipt.originalFileName,
    galleryLabel: buildReceiptGalleryLabel(ctx),
    expense: receipt.transaction
      ? {
          amount: Number(receipt.transaction.amount),
          description: receipt.transaction.description,
          status: receipt.transaction.expenseStatus,
          projectNumber: receipt.transaction.project?.projectNumber ?? null,
        }
      : null,
    fielder: receipt.transaction?.fielder
      ? {
          id: receipt.transaction.fielder.id,
          name: `${receipt.transaction.fielder.firstName} ${receipt.transaction.fielder.lastName}`,
        }
      : null,
  };
}
