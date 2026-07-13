import { sheetValuesToCsv } from "@uln/shared";
import { ApiError } from "./api";
import {
  createGoogleJwtAuth,
  getGoogleSheetsConfig,
  loadGoogleServiceAccountCredentials,
  parseSpreadsheetId,
} from "./google-credentials";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

async function getSheetsClient() {
  const { google } = await import("googleapis");
  const auth = await createGoogleJwtAuth([SHEETS_SCOPE]);
  return google.sheets({ version: "v4", auth });
}

export interface FetchedProjectSheet {
  csv: string;
  spreadsheetId: string;
  tabName: string;
  range: string;
  rowCount: number;
  fetchedAt: string;
}

export async function fetchProjectTrackerSheet(options?: {
  spreadsheetId?: string;
}): Promise<FetchedProjectSheet> {
  const config = getGoogleSheetsConfig();
  const spreadsheetId = parseSpreadsheetId(
    options?.spreadsheetId ?? config.spreadsheetId ?? ""
  );

  if (!spreadsheetId) {
    throw new ApiError(
      "Google Sheets sync is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID in your environment.",
      503
    );
  }

  const sheets = await getSheetsClient();
  let tabName = config.tabName;
  let range = config.range;

  if (!tabName && !range) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    tabName = meta.data.sheets?.[0]?.properties?.title ?? "Sheet1";
    range = quoteSheetTitle(tabName);
  } else if (tabName && !range) {
    range = quoteSheetTitle(tabName);
  } else if (!range) {
    range = "A:Z";
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: "ROWS",
  });

  const values = (response.data.values ?? []) as string[][];
  if (values.length === 0) {
    throw new ApiError("Google Sheet is empty or not shared with the service account", 400);
  }

  return {
    csv: sheetValuesToCsv(values),
    spreadsheetId,
    tabName: tabName ?? range,
    range,
    rowCount: values.length,
    fetchedAt: new Date().toISOString(),
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
  };
}
