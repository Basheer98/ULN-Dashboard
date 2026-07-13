import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { createGoogleJwtAuth } from "./google-credentials";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export interface StorageResult {
  fileKey: string;
  url: string;
  storageProvider: string;
  storageFileId?: string;
}

export interface StorageSaveOptions {
  /** Relative path inside the storage root, e.g. receipts/fielder-abc/2026-07/name.jpg */
  relativePath?: string;
  /** Human-readable filename used in cloud providers */
  displayName?: string;
}

export interface StorageProvider {
  save(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    options?: StorageSaveOptions
  ): Promise<StorageResult>;
  read(fileKey: string, storageFileId?: string | null): Promise<Buffer | null>;
  delete?(fileKey: string, storageFileId?: string | null): Promise<void>;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function normalizeKey(key: string): string {
  return key.replace(/\\/g, "/");
}

function fallbackKey(fileName: string): string {
  const ext = path.extname(fileName);
  return `${crypto.randomUUID()}${ext}`;
}

class LocalStorageProvider implements StorageProvider {
  async save(
    buffer: Buffer,
    fileName: string,
    _mimeType: string,
    options?: StorageSaveOptions
  ): Promise<StorageResult> {
    const fileKey = normalizeKey(options?.relativePath ?? fallbackKey(fileName));
    const fullPath = path.join(UPLOAD_DIR, fileKey);
    await ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, buffer);
    return {
      fileKey,
      url: `/api/v1/finance/receipts/file/${fileKey.split("/").map(encodeURIComponent).join("/")}`,
      storageProvider: "local",
    };
  }

  async read(fileKey: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(path.join(UPLOAD_DIR, normalizeKey(fileKey)));
    } catch {
      return null;
    }
  }
}

class GoogleDriveStorageProvider implements StorageProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drive: any = null;
  private folderCache = new Map<string, string>();

  private async getDrive() {
    if (this.drive) return this.drive;
    const { google } = await import("googleapis");
    const auth = await createGoogleJwtAuth([
      "https://www.googleapis.com/auth/drive.file",
    ]);
    this.drive = google.drive({ version: "v3", auth });
    return this.drive;
  }

  private async getOrCreateFolder(parentId: string | undefined, name: string): Promise<string> {
    const cacheKey = `${parentId ?? "root"}:${name}`;
    const cached = this.folderCache.get(cacheKey);
    if (cached) return cached;

    const drive = await this.getDrive();
    const q = [
      `name='${name.replace(/'/g, "\\'")}'`,
      "mimeType='application/vnd.google-apps.folder'",
      "trashed=false",
      parentId ? `'${parentId}' in parents` : undefined,
    ]
      .filter(Boolean)
      .join(" and ");

    const existing = await drive.files.list({
      q,
      fields: "files(id)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 1,
    });

    const foundId = existing.data.files?.[0]?.id as string | undefined;
    if (foundId) {
      this.folderCache.set(cacheKey, foundId);
      return foundId;
    }

    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : undefined,
      },
      fields: "id",
      supportsAllDrives: true,
    });

    const folderId = created.data.id as string;
    this.folderCache.set(cacheKey, folderId);
    return folderId;
  }

  private async resolveReceiptParents(relativePath?: string): Promise<string | undefined> {
    const rootFolderId = process.env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID;
    if (!relativePath) return rootFolderId;

    const parts = normalizeKey(relativePath).split("/").filter(Boolean);
    if (parts[0] !== "receipts") return rootFolderId;

    let parentId = rootFolderId;
    for (const segment of parts.slice(1, -1)) {
      parentId = await this.getOrCreateFolder(parentId, segment);
    }
    return parentId;
  }

  async save(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    options?: StorageSaveOptions
  ): Promise<StorageResult> {
    const drive = await this.getDrive();
    const relativePath = normalizeKey(options?.relativePath ?? fallbackKey(fileName));
    const driveFileName = options?.displayName ?? path.basename(relativePath);
    const parents = await this.resolveReceiptParents(relativePath);

    const res = await drive.files.create({
      requestBody: {
        name: driveFileName,
        parents: parents ? [parents] : undefined,
      },
      media: { mimeType, body: Readable.from(buffer) },
      fields: "id",
      supportsAllDrives: true,
    });

    const storageFileId = res.data.id as string;
    return {
      fileKey: relativePath,
      url: `/api/v1/finance/receipts/file/${relativePath.split("/").map(encodeURIComponent).join("/")}`,
      storageProvider: "google_drive",
      storageFileId,
    };
  }

  async read(_fileKey: string, storageFileId?: string | null): Promise<Buffer | null> {
    if (!storageFileId) return null;
    const drive = await this.getDrive();
    const res = await drive.files.get(
      { fileId: storageFileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(res.data as ArrayBuffer);
  }

  async delete(_fileKey: string, storageFileId?: string | null): Promise<void> {
    if (!storageFileId) return;
    const drive = await this.getDrive();
    await drive.files.delete({ fileId: storageFileId, supportsAllDrives: true });
  }
}

class S3StorageProvider implements StorageProvider {
  async save(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    options?: StorageSaveOptions
  ): Promise<StorageResult> {
    const fileKey = normalizeKey(options?.relativePath ?? fallbackKey(fileName));
    const endpoint = process.env.STORAGE_ENDPOINT!;
    const bucket = process.env.BUCKET_NAME!;
    const accessKey = process.env.BUCKET_ACCESS_KEY!;
    const secretKey = process.env.BUCKET_SECRET_KEY!;

    const url = `${endpoint}/${bucket}/${fileKey}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
        Authorization: `Bearer ${accessKey}:${secretKey}`,
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) throw new Error(`Storage upload failed: ${res.status}`);
    return {
      fileKey,
      url: `/api/v1/finance/receipts/file/${fileKey.split("/").map(encodeURIComponent).join("/")}`,
      storageProvider: "s3",
    };
  }

  async read(): Promise<Buffer | null> {
    return null;
  }
}

function getProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  if (provider === "google_drive") return new GoogleDriveStorageProvider();
  if (process.env.STORAGE_ENDPOINT && process.env.BUCKET_NAME) {
    return new S3StorageProvider();
  }
  return new LocalStorageProvider();
}

const provider = getProvider();

export async function saveFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  options?: StorageSaveOptions
): Promise<StorageResult> {
  return provider.save(buffer, fileName, mimeType, options);
}

export async function readFile(
  fileKey: string,
  storageFileId?: string | null
): Promise<Buffer | null> {
  return provider.read(normalizeKey(fileKey), storageFileId);
}

export async function deleteFile(
  fileKey: string,
  storageFileId?: string | null
): Promise<void> {
  if (provider.delete) {
    await provider.delete(normalizeKey(fileKey), storageFileId);
  }
}

export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/** @deprecated use saveFile */
export { saveFile as saveAttachment };
