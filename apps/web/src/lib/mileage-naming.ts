export interface MileageNamingContext {
  date?: Date | string | null;
  fielderId?: string | null;
  fielderFirstName?: string | null;
  fielderLastName?: string | null;
  projectNumber?: string | null;
  kind: "start_odometer" | "end_odometer";
  odometerReading?: number | null;
}

function slugPart(value: string, maxLen = 32): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLen) || "item"
  );
}

function formatDatePart(value?: Date | string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function monthFolder(value?: Date | string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 7);
  return date.toISOString().slice(0, 7);
}

export function mileageFielderFolderName(ctx: MileageNamingContext): string {
  if (ctx.fielderFirstName || ctx.fielderLastName) {
    return slugPart(`${ctx.fielderFirstName ?? ""} ${ctx.fielderLastName ?? ""}`.trim(), 40);
  }
  if (ctx.fielderId) return `fielder-${ctx.fielderId.slice(0, 8)}`;
  return "Office";
}

export function buildMileagePhotoDisplayName(ctx: MileageNamingContext, ext: string): string {
  const date = formatDatePart(ctx.date);
  const fielder = mileageFielderFolderName(ctx);
  const project = slugPart(ctx.projectNumber ?? "No-Project", 20);
  const kind = ctx.kind === "start_odometer" ? "start" : "end";
  const reading =
    ctx.odometerReading != null && Number.isFinite(ctx.odometerReading)
      ? String(ctx.odometerReading).replace(".", "-")
      : "reading";
  const safeExt = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return `${date}_${fielder}_${project}_${kind}_${reading}${safeExt}`;
}

/**
 * Drive / local path:
 * mileage/{Fielder-Name}/{YYYY-MM}/{unique}_{displayName}
 */
export function buildMileagePhotoStoragePath(
  ctx: MileageNamingContext,
  uniqueId: string,
  ext: string
): string {
  const fielderFolder = mileageFielderFolderName(ctx);
  const month = monthFolder(ctx.date);
  const base = buildMileagePhotoDisplayName(ctx, ext).replace(/\.[^.]+$/, "");
  const safeExt = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  const unique = uniqueId.slice(0, 8);
  return `mileage/${fielderFolder}/${month}/${unique}_${base}${safeExt}`;
}
