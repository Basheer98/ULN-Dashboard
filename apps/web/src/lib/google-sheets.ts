import { ApiError } from "./api";
import {
  createGoogleJwtAuth,
  getGoogleSheetsConfig,
  loadGoogleServiceAccountCredentials,
  parseSpreadsheetId,
} from "./google-credentials";
import { sheetValuesToCsv } from "@uln/shared";

/** Read+write so import can push status back to the tracker. */
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

function colLetter(indexZeroBased: number): string {
  let n = indexZeroBased + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const HEADER_FIELD: Record<string, string> = {
  "project id": "projectNumber",
  "project #": "projectNumber",
  "project number": "projectNumber",
  sqft: "sqft",
  feilder: "fielder",
  fielder: "fielder",
  assigned: "assigned",
  "feilding status": "fieldingStatus",
  "fielding status": "fieldingStatus",
  "data status": "dataStatus",
  submitted: "submitted",
  notes: "notes",
};

async function getSheetsClient() {
  const { google } = await import("googleapis");
  const auth = await createGoogleJwtAuth([SHEETS_SCOPE]);
  return google.sheets({ version: "v4", auth });
}

async function resolveSheetRange(spreadsheetId?: string): Promise<{
  spreadsheetId: string;
  tabName: string;
  range: string;
}> {
  const config = getGoogleSheetsConfig();
  const id = parseSpreadsheetId(spreadsheetId ?? config.spreadsheetId ?? "");
  if (!id) {
    throw new ApiError(
      "Google Sheets sync is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID in your environment.",
      503
    );
  }

  const sheets = await getSheetsClient();
  let tabName = config.tabName;
  let range = config.range;

  if (!tabName && !range) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    tabName = meta.data.sheets?.[0]?.properties?.title ?? "Sheet1";
    range = quoteSheetTitle(tabName);
  } else if (tabName && !range) {
    range = quoteSheetTitle(tabName);
  } else if (!range) {
    range = "A:Z";
  }

  return { spreadsheetId: id, tabName: tabName ?? range, range };
}

export interface FetchedProjectSheet {
  csv: string;
  spreadsheetId: string;
  tabName: string;
  range: string;
  rowCount: number;
  fetchedAt: string;
  values: string[][];
}

export async function fetchProjectTrackerSheet(options?: {
  spreadsheetId?: string;
  tabName?: string;
}): Promise<FetchedProjectSheet> {
  const config = getGoogleSheetsConfig();
  const id = parseSpreadsheetId(options?.spreadsheetId ?? config.spreadsheetId ?? "");
  if (!id) {
    throw new ApiError(
      "Google Sheets sync is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID in your environment.",
      503
    );
  }

  const sheets = await getSheetsClient();
  let tabName = options?.tabName ?? config.tabName;
  let range = config.range;

  if (options?.tabName) {
    tabName = options.tabName;
    range = quoteSheetTitle(options.tabName);
  } else if (!tabName && !range) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    tabName = meta.data.sheets?.[0]?.properties?.title ?? "Sheet1";
    range = quoteSheetTitle(tabName);
  } else if (tabName && !range) {
    range = quoteSheetTitle(tabName);
  } else if (!range) {
    range = "A:Z";
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: range!,
    majorDimension: "ROWS",
  });

  const values = (response.data.values ?? []) as string[][];
  if (values.length === 0) {
    throw new ApiError("Google Sheet is empty or not shared with the service account", 400);
  }

  return {
    csv: sheetValuesToCsv(values),
    spreadsheetId: id,
    tabName: tabName ?? range!,
    range: range!,
    rowCount: values.length,
    fetchedAt: new Date().toISOString(),
    values,
  };
}

const SKIP_TAB_PATTERNS = [/form\s*responses/i, /^sheet\d+$/i];

export function isImportableSheetTab(title: string): boolean {
  const t = title.trim();
  if (!t) return false;
  return !SKIP_TAB_PATTERNS.some((re) => re.test(t));
}

export async function listProjectSheetTabs(spreadsheetId?: string): Promise<{
  spreadsheetId: string;
  tabs: string[];
}> {
  const config = getGoogleSheetsConfig();
  const id = parseSpreadsheetId(spreadsheetId ?? config.spreadsheetId ?? "");
  if (!id) {
    throw new ApiError(
      "Google Sheets sync is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID in your environment.",
      503
    );
  }
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  const tabs = (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? "")
    .filter((title) => isImportableSheetTab(title));
  return { spreadsheetId: id, tabs };
}

export async function fetchAllProjectTrackerTabs(options?: {
  spreadsheetId?: string;
}): Promise<{
  spreadsheetId: string;
  tabs: FetchedProjectSheet[];
  skipped: string[];
}> {
  const { spreadsheetId, tabs } = await listProjectSheetTabs(options?.spreadsheetId);
  const fetched: FetchedProjectSheet[] = [];
  const skipped: string[] = [];

  for (const tabName of tabs) {
    try {
      const sheet = await fetchProjectTrackerSheet({ spreadsheetId, tabName });
      if (sheet.rowCount < 2) {
        skipped.push(tabName);
        continue;
      }
      fetched.push(sheet);
    } catch {
      skipped.push(tabName);
    }
  }

  return { spreadsheetId, tabs: fetched, skipped };
}

export type ProjectSheetWriteRow = {
  projectNumber: string;
  sqft?: number | null;
  fielderName?: string | null;
  /** Dashboard project status */
  status?: string | null;
  notes?: string | null;
};

function mapStatusToSheetColumns(status: string | null | undefined): {
  assigned: string;
  fieldingStatus: string;
  dataStatus: string;
  submitted: string;
} {
  switch (status) {
    case "invoiced":
    case "paid":
      return {
        assigned: "Assigned",
        fieldingStatus: "Completed",
        dataStatus: "Completed",
        submitted: "Submitted",
      };
    case "complete":
      return {
        assigned: "Assigned",
        fieldingStatus: "Completed",
        dataStatus: "Completed",
        submitted: "",
      };
    case "in_progress":
      return {
        assigned: "Assigned",
        fieldingStatus: "In Progress",
        dataStatus: "",
        submitted: "",
      };
    case "assigned":
      return {
        assigned: "Assigned",
        fieldingStatus: "",
        dataStatus: "",
        submitted: "",
      };
    default:
      return {
        assigned: "",
        fieldingStatus: "",
        dataStatus: "",
        submitted: "",
      };
  }
}

export interface SheetWriteBackResult {
  updated: number;
  skipped: number;
  unmatched: string[];
  spreadsheetId: string;
  tabName: string;
}

/**
 * Write project status / fielder / SQFT back into the tracker sheet by Project ID.
 * Only updates known header columns; never invents new rows.
 */
export async function writeBackProjectsToSheet(
  rows: ProjectSheetWriteRow[],
  options?: { spreadsheetId?: string }
): Promise<SheetWriteBackResult> {
  if (rows.length === 0) {
    const resolved = await resolveSheetRange(options?.spreadsheetId);
    return {
      updated: 0,
      skipped: 0,
      unmatched: [],
      spreadsheetId: resolved.spreadsheetId,
      tabName: resolved.tabName,
    };
  }

  const sheet = await fetchProjectTrackerSheet(options);
  const [headerRow, ...dataRows] = sheet.values;
  if (!headerRow?.length) {
    throw new ApiError("Sheet has no header row", 400);
  }

  const fieldIndex = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const field = HEADER_FIELD[normalizeHeader(String(h ?? ""))];
    if (field && !fieldIndex.has(field)) fieldIndex.set(field, i);
  });

  const projectCol = fieldIndex.get("projectNumber");
  if (projectCol === undefined) {
    throw new ApiError("Sheet is missing a Project ID column", 400);
  }

  const byProject = new Map(
    rows.map((r) => [r.projectNumber.trim().toLowerCase(), r] as const)
  );

  const updates: Array<{ range: string; values: string[][] }> = [];
  let updated = 0;
  let skipped = 0;
  const matched = new Set<string>();

  const tabPrefix = quoteSheetTitle(sheet.tabName);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] ?? [];
    const projectNumber = String(row[projectCol] ?? "").trim();
    if (!projectNumber) continue;

    const payload = byProject.get(projectNumber.toLowerCase());
    if (!payload) continue;
    matched.add(projectNumber.toLowerCase());

    const sheetStatus = mapStatusToSheetColumns(payload.status);
    const rowNumber = i + 2; // 1-based, header is row 1

    const cellUpdates: Array<{ col: number; value: string }> = [];

    if (payload.sqft != null && fieldIndex.has("sqft")) {
      cellUpdates.push({
        col: fieldIndex.get("sqft")!,
        value: String(Math.round(payload.sqft)),
      });
    }
    if (payload.fielderName != null && fieldIndex.has("fielder")) {
      cellUpdates.push({
        col: fieldIndex.get("fielder")!,
        value: payload.fielderName,
      });
    }
    if (payload.status != null) {
      if (fieldIndex.has("assigned")) {
        cellUpdates.push({ col: fieldIndex.get("assigned")!, value: sheetStatus.assigned });
      }
      if (fieldIndex.has("fieldingStatus")) {
        cellUpdates.push({
          col: fieldIndex.get("fieldingStatus")!,
          value: sheetStatus.fieldingStatus,
        });
      }
      if (fieldIndex.has("dataStatus")) {
        cellUpdates.push({
          col: fieldIndex.get("dataStatus")!,
          value: sheetStatus.dataStatus,
        });
      }
      if (fieldIndex.has("submitted")) {
        cellUpdates.push({
          col: fieldIndex.get("submitted")!,
          value: sheetStatus.submitted,
        });
      }
    }
    if (payload.notes != null && fieldIndex.has("notes")) {
      cellUpdates.push({ col: fieldIndex.get("notes")!, value: payload.notes });
    }

    if (cellUpdates.length === 0) {
      skipped++;
      continue;
    }

    for (const cell of cellUpdates) {
      const a1 = `${tabPrefix}!${colLetter(cell.col)}${rowNumber}`;
      updates.push({ range: a1, values: [[cell.value]] });
    }
    updated++;
  }

  if (updates.length > 0) {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheet.spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updates,
      },
    });
  }

  const unmatched = rows
    .map((r) => r.projectNumber)
    .filter((pn) => !matched.has(pn.trim().toLowerCase()));

  return {
    updated,
    skipped,
    unmatched,
    spreadsheetId: sheet.spreadsheetId,
    tabName: sheet.tabName,
  };
}

export async function getProjectSheetStatus() {
  const config = getGoogleSheetsConfig();
  let serviceAccountEmail: string | null = null;

  try {
    const creds = await loadGoogleServiceAccountCredentials();
    serviceAccountEmail = creds.email;
  } catch {
    serviceAccountEmail = null;
  }

  return {
    ...config,
    hasCredentials: Boolean(serviceAccountEmail),
    serviceAccountEmail,
    ready: config.configured && Boolean(serviceAccountEmail),
    writeEnabled: Boolean(process.env.GOOGLE_SHEETS_WRITE_BACK !== "false"),
  };
}
