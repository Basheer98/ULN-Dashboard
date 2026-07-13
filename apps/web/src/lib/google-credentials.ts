import { promises as fs } from "fs";

export async function loadGoogleServiceAccountCredentials(): Promise<{
  email: string;
  key: string;
}> {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    const raw = await fs.readFile(credPath, "utf8");
    const json = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!json.client_email || !json.private_key) {
      throw new Error("Invalid Google service account JSON");
    }
    return { email: json.client_email, key: json.private_key };
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error(
      "Google credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY."
    );
  }
  return { email, key };
}

export async function createGoogleJwtAuth(scopes: string[]) {
  const { google } = await import("googleapis");
  const { email, key } = await loadGoogleServiceAccountCredentials();
  return new google.auth.JWT({ email, key, scopes });
}

export function getGoogleSheetsConfig() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const tabName = process.env.GOOGLE_SHEETS_TAB_NAME?.trim();
  const range = process.env.GOOGLE_SHEETS_RANGE?.trim();
  return {
    configured: Boolean(spreadsheetId),
    spreadsheetId: spreadsheetId ?? null,
    tabName: tabName ?? null,
    range: range ?? null,
  };
}

/** Extract spreadsheet ID from a full Google Sheets URL or raw ID. */
export function parseSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (fromUrl?.[1]) return fromUrl[1];
  return trimmed;
}
