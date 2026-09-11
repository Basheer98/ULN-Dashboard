import * as FileSystem from "expo-file-system/legacy";
import { API_URL, apiRequest } from "./api";
import { getToken } from "./auth";

const QUEUE_DIR = `${FileSystem.documentDirectory}offline-queue/`;
const INDEX_PATH = `${QUEUE_DIR}index.json`;
const FILES_DIR = `${QUEUE_DIR}files/`;

export type OfflineExpenseDraft = {
  kind: "expense";
  id: string;
  createdAt: string;
  payload: {
    transactionDate: string;
    amount: number;
    description: string;
    businessPurpose?: string;
    categoryId: string | null;
    projectId: string | null;
    paidBy: "company" | "employee";
    isReimbursable: boolean;
    expenseStatus?: string;
    isOffice: boolean;
  };
  receiptLocalUri?: string;
  receiptName?: string;
};

export type OfflineMileageDraft = {
  kind: "mileage";
  id: string;
  createdAt: string;
  payload: {
    date: string;
    startLocation?: string;
    destination?: string;
    startOdometer: number;
    endOdometer: number;
    businessPurpose?: string;
  };
  startPhotoLocalUri: string;
  endPhotoLocalUri: string;
};

export type OfflineDraft = OfflineExpenseDraft | OfflineMileageDraft;

async function ensureDirs() {
  const dir = await FileSystem.getInfoAsync(QUEUE_DIR);
  if (!dir.exists) {
    await FileSystem.makeDirectoryAsync(QUEUE_DIR, { intermediates: true });
  }
  const files = await FileSystem.getInfoAsync(FILES_DIR);
  if (!files.exists) {
    await FileSystem.makeDirectoryAsync(FILES_DIR, { intermediates: true });
  }
}

async function readIndex(): Promise<OfflineDraft[]> {
  await ensureDirs();
  const info = await FileSystem.getInfoAsync(INDEX_PATH);
  if (!info.exists) return [];
  try {
    const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
    const parsed = JSON.parse(raw) as OfflineDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(items: OfflineDraft[]) {
  await ensureDirs();
  await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(items));
}

export async function listOfflineDrafts(): Promise<OfflineDraft[]> {
  return readIndex();
}

export async function countOfflineDrafts(): Promise<number> {
  return (await readIndex()).length;
}

async function persistLocalFile(sourceUri: string, name: string): Promise<string> {
  await ensureDirs();
  const dest = `${FILES_DIR}${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function saveExpenseDraft(input: {
  payload: OfflineExpenseDraft["payload"];
  receiptUri?: string | null;
  receiptName?: string | null;
}): Promise<OfflineExpenseDraft> {
  const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let receiptLocalUri: string | undefined;
  if (input.receiptUri) {
    receiptLocalUri = await persistLocalFile(
      input.receiptUri,
      input.receiptName ?? "receipt.jpg"
    );
  }
  const draft: OfflineExpenseDraft = {
    kind: "expense",
    id,
    createdAt: new Date().toISOString(),
    payload: input.payload,
    receiptLocalUri,
    receiptName: input.receiptName ?? undefined,
  };
  const items = await readIndex();
  items.unshift(draft);
  await writeIndex(items);
  return draft;
}

export async function saveMileageDraft(input: {
  payload: OfflineMileageDraft["payload"];
  startPhotoUri: string;
  endPhotoUri: string;
}): Promise<OfflineMileageDraft> {
  const id = `mil_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startPhotoLocalUri = await persistLocalFile(input.startPhotoUri, "start.jpg");
  const endPhotoLocalUri = await persistLocalFile(input.endPhotoUri, "end.jpg");
  const draft: OfflineMileageDraft = {
    kind: "mileage",
    id,
    createdAt: new Date().toISOString(),
    payload: input.payload,
    startPhotoLocalUri,
    endPhotoLocalUri,
  };
  const items = await readIndex();
  items.unshift(draft);
  await writeIndex(items);
  return draft;
}

async function removeDraftFiles(draft: OfflineDraft) {
  const uris =
    draft.kind === "expense"
      ? [draft.receiptLocalUri]
      : [draft.startPhotoLocalUri, draft.endPhotoLocalUri];
  for (const uri of uris) {
    if (!uri) continue;
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      /* ignore */
    }
  }
}

export async function removeOfflineDraft(id: string) {
  const items = await readIndex();
  const draft = items.find((d) => d.id === id);
  if (draft) await removeDraftFiles(draft);
  await writeIndex(items.filter((d) => d.id !== id));
}

async function uploadPhoto(
  token: string,
  path: "finance/receipts/scan" | "finance/mileage/photos",
  localUri: string,
  name: string,
  extra?: Record<string, string>
): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append("file", {
    uri: localUri,
    name,
    type: "image/jpeg",
  } as unknown as Blob);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      form.append(key, value);
    }
  }
  const response = await fetch(`${API_URL}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Upload failed");
  return data;
}

async function flushExpense(token: string, draft: OfflineExpenseDraft) {
  let receiptId: string | undefined;
  if (draft.receiptLocalUri) {
    const scan = await uploadPhoto(
      token,
      "finance/receipts/scan",
      draft.receiptLocalUri,
      draft.receiptName ?? "receipt.jpg",
      draft.payload.projectId ? { projectId: draft.payload.projectId } : undefined
    );
    receiptId = (scan.receipt as { id: string } | undefined)?.id;
  }

  await apiRequest(draft.payload.isOffice ? "/finance/expenses" : "/finance/expenses/mine", {
    method: "POST",
    token,
    body: JSON.stringify({
      transactionDate: draft.payload.transactionDate,
      amount: draft.payload.amount,
      description: draft.payload.description,
      businessPurpose: draft.payload.businessPurpose,
      categoryId: draft.payload.categoryId,
      projectId: draft.payload.projectId,
      paidBy: draft.payload.paidBy,
      isReimbursable: draft.payload.isReimbursable,
      expenseStatus: draft.payload.expenseStatus,
      receiptId,
      acknowledgeDuplicate: true,
    }),
  });
}

async function flushMileage(token: string, draft: OfflineMileageDraft) {
  const start = await uploadPhoto(
    token,
    "finance/mileage/photos",
    draft.startPhotoLocalUri,
    "start.jpg",
    {
      kind: "start_odometer",
      date: draft.payload.date,
      odometer: String(draft.payload.startOdometer),
    }
  );
  const end = await uploadPhoto(
    token,
    "finance/mileage/photos",
    draft.endPhotoLocalUri,
    "end.jpg",
    {
      kind: "end_odometer",
      date: draft.payload.date,
      odometer: String(draft.payload.endOdometer),
    }
  );

  await apiRequest("/finance/mileage", {
    method: "POST",
    token,
    body: JSON.stringify({
      ...draft.payload,
      isReimbursable: true,
      startPhotoId: start.id,
      endPhotoId: end.id,
    }),
  });
}

export async function flushOfflineDrafts(): Promise<{ sent: number; failed: number }> {
  const token = await getToken();
  if (!token) return { sent: 0, failed: 0 };

  const items = await readIndex();
  let sent = 0;
  let failed = 0;
  const remaining: OfflineDraft[] = [];

  for (const draft of items) {
    try {
      if (draft.kind === "expense") await flushExpense(token, draft);
      else await flushMileage(token, draft);
      await removeDraftFiles(draft);
      sent += 1;
    } catch {
      remaining.push(draft);
      failed += 1;
    }
  }

  await writeIndex(remaining);
  return { sent, failed };
}

/** True when the error looks like connectivity / timeout rather than validation. */
export function looksLikeOfflineError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("failed to fetch") ||
    message.includes("network request failed") ||
    message.includes("aborted") ||
    message.includes("offline")
  );
}
