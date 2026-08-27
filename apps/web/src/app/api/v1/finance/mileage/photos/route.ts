import { NextRequest } from "next/server";
import path from "path";
import crypto from "crypto";
import {
  ALLOWED_RECEIPT_MIMES,
  MAX_RECEIPT_SIZE,
  hasPermission,
  mileagePhotoKindSchema,
} from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { saveFile, computeFileHash } from "@/lib/storage";
import { serializeMileagePhoto } from "@/lib/mileage";
import {
  buildMileagePhotoDisplayName,
  buildMileagePhotoStoragePath,
} from "@/lib/mileage-naming";

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return jsonError("Unauthorized", 401);

    const canUpload =
      hasPermission(user.role, "finance:write") ||
      hasPermission(user.role, "finance:admin") ||
      hasPermission(user.role, "mileage:self:create");
    if (!canUpload) return jsonError("Forbidden", 403);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return jsonError("File required", 400);

    const kindParsed = mileagePhotoKindSchema.safeParse(formData.get("kind")?.toString());
    if (!kindParsed.success) {
      return jsonError("kind must be start_odometer or end_odometer", 400);
    }

    if (!ALLOWED_RECEIPT_MIMES.includes(file.type) || file.type === "application/pdf") {
      return jsonError("Odometer photo must be an image (JPEG, PNG, WebP, or HEIC)", 400);
    }

    if (file.size > MAX_RECEIPT_SIZE) {
      return jsonError(`File too large. Max size: ${MAX_RECEIPT_SIZE / 1024 / 1024}MB`, 400);
    }

    const projectId = formData.get("projectId")?.toString() || null;
    const odometerRaw = formData.get("odometer")?.toString();
    const odometerReading = odometerRaw ? Number.parseFloat(odometerRaw) : null;
    const dateRaw = formData.get("date")?.toString() || null;

    let fielderFirstName: string | null = null;
    let fielderLastName: string | null = null;
    let fielderId: string | null = user.role === "fielder" ? user.fielderId : null;
    let projectNumber: string | null = null;

    if (fielderId) {
      const fielder = await prisma.fielder.findUnique({
        where: { id: fielderId },
        select: { firstName: true, lastName: true },
      });
      fielderFirstName = fielder?.firstName ?? null;
      fielderLastName = fielder?.lastName ?? null;
    } else if (formData.get("fielderId")?.toString()) {
      fielderId = formData.get("fielderId")!.toString();
      const fielder = await prisma.fielder.findUnique({
        where: { id: fielderId },
        select: { firstName: true, lastName: true },
      });
      fielderFirstName = fielder?.firstName ?? null;
      fielderLastName = fielder?.lastName ?? null;
    }

    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { projectNumber: true },
      });
      projectNumber = project?.projectNumber ?? null;
    }

    const namingCtx = {
      date: dateRaw || new Date(),
      fielderId,
      fielderFirstName,
      fielderLastName,
      projectNumber,
      kind: kindParsed.data,
      odometerReading: Number.isFinite(odometerReading) ? odometerReading : null,
    };

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = computeFileHash(buffer);
    const ext = path.extname(file.name) || ".jpg";
    const uniqueId = crypto.randomUUID();
    const displayName = buildMileagePhotoDisplayName(namingCtx, ext);
    const relativePath = buildMileagePhotoStoragePath(namingCtx, uniqueId, ext);

    const stored = await saveFile(buffer, file.name, file.type, {
      relativePath,
      displayName,
    });

    const photo = await prisma.mileagePhoto.create({
      data: {
        kind: kindParsed.data,
        originalFileName: displayName,
        storedFileName: stored.fileKey,
        mimeType: file.type,
        fileSize: file.size,
        storageProvider: stored.storageProvider,
        storageFileId: stored.storageFileId ?? null,
        storageUrl: stored.url,
        fileHash,
        uploadedById: user.id,
      },
    });

    return jsonOk(serializeMileagePhoto(photo), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
