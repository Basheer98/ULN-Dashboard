export interface ReceiptNamingContext {
  transactionDate?: Date | string | null;
  fielderId?: string | null;
  fielderFirstName?: string | null;
  fielderLastName?: string | null;
  projectNumber?: string | null;
  amount?: number | null;
  description?: string | null;
  categoryName?: string | null;
}

function slugPart(value: string, maxLen = 32): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen) || "item";
}

function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "0";
  return amount.toFixed(2).replace(".", "-");
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

export function buildReceiptDisplayName(
  ctx: ReceiptNamingContext,
  ext: string
): string {
  const date = formatDatePart(ctx.transactionDate);
  const fielder =
    ctx.fielderFirstName || ctx.fielderLastName
      ? slugPart(`${ctx.fielderFirstName ?? ""} ${ctx.fielderLastName ?? ""}`.trim(), 24)
      : "Company";
  const project = slugPart(ctx.projectNumber ?? "No-Project", 20);
  const amount = formatAmount(ctx.amount);
  const detail = slugPart(
    ctx.description || ctx.categoryName || "Receipt",
    28
  );
  const safeExt = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return `${date}_${fielder}_${project}_$${amount}_${detail}${safeExt}`;
}

export function buildReceiptStorageFolder(ctx: ReceiptNamingContext): {
  fielderFolder: string;
  monthFolder: string;
} {
  const fielderFolder = ctx.fielderId
    ? `fielder-${ctx.fielderId}`
    : "company";
  return {
    fielderFolder,
    monthFolder: monthFolder(ctx.transactionDate),
  };
}

export function buildReceiptStoragePath(
  ctx: ReceiptNamingContext,
  uniqueId: string,
  ext: string
): string {
  const { fielderFolder, monthFolder: month } = buildReceiptStorageFolder(ctx);
  const base = buildReceiptDisplayName(ctx, ext).replace(/\.[^.]+$/, "");
  const safeExt = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  const unique = uniqueId.slice(0, 8);
  return `receipts/${fielderFolder}/${month}/${unique}_${base}${safeExt}`;
}

export function buildReceiptGalleryLabel(ctx: ReceiptNamingContext): string {
  const date = formatDatePart(ctx.transactionDate);
  const fielder =
    ctx.fielderFirstName || ctx.fielderLastName
      ? `${ctx.fielderFirstName ?? ""} ${ctx.fielderLastName ?? ""}`.trim()
      : "Company";
  const project = ctx.projectNumber ?? "No project";
  const amount =
    ctx.amount !== null && ctx.amount !== undefined
      ? `$${Number(ctx.amount).toFixed(2)}`
      : "$0.00";
  const detail = ctx.description || ctx.categoryName || "Receipt";
  return `${date} · ${fielder} · ${project} · ${amount} · ${detail}`;
}

export function fielderFolderLabel(
  firstName?: string | null,
  lastName?: string | null,
  fielderId?: string | null
): string {
  if (firstName || lastName) {
    return `${firstName ?? ""} ${lastName ?? ""}`.trim();
  }
  if (fielderId) return `Fielder ${fielderId.slice(0, 8)}`;
  return "Company / Office";
}
