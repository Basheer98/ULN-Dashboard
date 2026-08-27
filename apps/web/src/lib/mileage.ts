import { toNumber } from "@uln/shared";

export const mileagePhotoInclude = {
  photos: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" as const },
  },
};

export function serializeMileagePhoto(photo: {
  id: string;
  kind: string;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  fileSize: number;
  storageUrl: string | null;
}) {
  return {
    id: photo.id,
    kind: photo.kind,
    originalFileName: photo.originalFileName,
    storedFileName: photo.storedFileName,
    mimeType: photo.mimeType,
    fileSize: photo.fileSize,
    url: `/api/v1/finance/mileage/photos/file/${photo.storedFileName
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
  };
}

export function serializeMileage(entry: {
  totalMiles: unknown;
  startOdometer: unknown;
  endOdometer: unknown;
  mileageRate: unknown;
  reimbursement: unknown;
  photos?: Array<{
    id: string;
    kind: string;
    originalFileName: string;
    storedFileName: string;
    mimeType: string;
    fileSize: number;
    storageUrl: string | null;
  }>;
  [key: string]: unknown;
}) {
  const photos = (entry.photos ?? []).map(serializeMileagePhoto);
  return {
    ...entry,
    totalMiles: toNumber(entry.totalMiles),
    startOdometer: entry.startOdometer != null ? toNumber(entry.startOdometer) : null,
    endOdometer: entry.endOdometer != null ? toNumber(entry.endOdometer) : null,
    mileageRate: toNumber(entry.mileageRate),
    reimbursement: toNumber(entry.reimbursement),
    photos,
    startPhoto: photos.find((p) => p.kind === "start_odometer") ?? null,
    endPhoto: photos.find((p) => p.kind === "end_odometer") ?? null,
  };
}
