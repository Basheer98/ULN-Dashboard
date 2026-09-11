import { US_STATES } from "./states";

export type ProjectImportStatus =
  | "draft"
  | "assigned"
  | "in_progress"
  | "complete"
  | "invoiced"
  | "paid"
  | "cancelled";

export type AssignmentImportStatus =
  | "assigned"
  | "accepted"
  | "in_progress"
  | "complete"
  | "cancelled";

export type ImportIssueLevel = "error" | "warning";

export interface ImportIssue {
  level: ImportIssueLevel;
  code: string;
  message: string;
}

export interface FielderLookupRecord {
  id: string;
  firstName: string;
  lastName: string;
}

export interface NormalizedImportRow {
  rowNumber: number;
  projectNumber: string;
  sqft: number;
  buriedSqft: number | null;
  aerialSqft: number | null;
  qfield: number | null;
  aerial: boolean;
  dueDate: string | null;
  siteAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  fielderName: string | null;
  fielderId: string | null;
  projectStatus: ProjectImportStatus;
  assignmentStatus: AssignmentImportStatus | null;
  notes: string | null;
  issues: ImportIssue[];
  /** Row can be imported when there are no error-level issues */
  importable: boolean;
}

export interface ImportParseSummary {
  format: "tracker" | "legacy" | "unknown";
  headers: string[];
  rows: NormalizedImportRow[];
  duplicateProjectNumbers: string[];
  stats: {
    total: number;
    importable: number;
    errors: number;
    warnings: number;
    skippedEmpty: number;
  };
}

const TRACKER_HEADER_ALIASES: Record<string, string> = {
  "project id": "projectNumber",
  "project #": "projectNumber",
  "project number": "projectNumber",
  qfield: "qfield",
  sqft: "sqft",
  "#": "buriedSqft",
  buried: "buriedSqft",
  "buried sqft": "buriedSqft",
  aerial: "aerial",
  "aerial sqft": "aerial",
  ecd: "ecd",
  address: "address",
  feilder: "fielder",
  fielder: "fielder",
  assigned: "assigned",
  "feilding status": "fieldingStatus",
  "fielding status": "fieldingStatus",
  "data status": "dataStatus",
  submitted: "submitted",
  notes: "notes",
};

const LEGACY_HEADER_ALIASES: Record<string, string> = {
  "project #": "projectNumber",
  "project number": "projectNumber",
  client: "client",
  title: "title",
  sqft: "sqft",
  qfield: "qfield",
  address: "address",
  state: "state",
  ecd: "ecd",
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function detectDelimiter(sampleLine: string): "," | "\t" {
  const tabs = (sampleLine.match(/\t/g) ?? []).length;
  const commas = (sampleLine.match(/,/g) ?? []).length;
  return tabs > commas ? "\t" : ",";
}

/** Parse CSV text with quoted fields (commas inside quotes). */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }

  return rows;
}

export function parseSheetRows(text: string): string[][] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);

  if (delimiter === "\t") {
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.split("\t").map((c) => c.trim()))
      .filter((row) => row.some((c) => c.trim() !== ""));
  }

  return parseCsvRows(trimmed);
}

function mapHeaders(headers: string[]): {
  format: "tracker" | "legacy" | "unknown";
  indexByField: Map<string, number>;
} {
  const normalized = headers.map(normalizeHeader);
  const indexByField = new Map<string, number>();

  for (let i = 0; i < normalized.length; i++) {
    const trackerKey = TRACKER_HEADER_ALIASES[normalized[i]];
    const legacyKey = LEGACY_HEADER_ALIASES[normalized[i]];
    const key = trackerKey ?? legacyKey;
    if (key && !indexByField.has(key)) indexByField.set(key, i);
  }

  if (indexByField.has("projectNumber") && indexByField.has("fielder")) {
    return { format: "tracker", indexByField };
  }
  if (indexByField.has("projectNumber") && indexByField.has("client")) {
    return { format: "legacy", indexByField };
  }
  return { format: "unknown", indexByField };
}

export function parseSqft(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

export function parseQfield(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const num = Number(digits);
  if (num === 1 || num === 2) return num;
  return null;
}

export function parseImportDate(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const d = new Date(value.trim());
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function normalizeStateCode(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  const byCode = US_STATES.find((s) => s.code.toLowerCase() === v.toLowerCase());
  if (byCode) return byCode.code;
  const byName = US_STATES.find((s) => s.name.toLowerCase() === v.toLowerCase());
  return byName?.code ?? null;
}

const FULL_ADDRESS_RE =
  /^(.+),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/i;

export function parseSiteAddress(
  raw: string | undefined,
  qfield: number | null
): {
  siteAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  warnings: ImportIssue[];
} {
  const warnings: ImportIssue[] = [];
  const trimmed = raw?.trim() ?? "";

  if (!trimmed) {
    return {
      siteAddress: "—",
      city: null,
      state: null,
      zip: null,
      warnings: [{ level: "error", code: "missing_address", message: "Address is required" }],
    };
  }

  const full = trimmed.match(FULL_ADDRESS_RE);
  if (full) {
    const state = normalizeStateCode(full[3]);
    return {
      siteAddress: full[1].trim(),
      city: full[2].trim(),
      state,
      zip: full[4],
      warnings: state
        ? []
        : [{ level: "warning", code: "unknown_state", message: `Unknown state code: ${full[3]}` }],
    };
  }

  if (/^nebraka$/i.test(trimmed)) {
    return {
      siteAddress: trimmed,
      city: null,
      state: qfield === 2 ? "NE" : null,
      zip: null,
      warnings: [
        {
          level: "warning",
          code: "placeholder_address",
          message:
            qfield === 2
              ? 'Placeholder address "Nebraka" — state inferred as NE (Qfield_2)'
              : 'Placeholder address "Nebraka" — verify state before billing',
        },
      ],
    };
  }

  const stateZip = trimmed.match(/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/i);
  const state = stateZip ? normalizeStateCode(stateZip[1]) : null;

  return {
    siteAddress: trimmed,
    city: null,
    state,
    zip: stateZip?.[2] ?? null,
    warnings: [
      {
        level: "warning",
        code: "partial_address",
        message: "Could not fully parse address — verify city/state before billing",
      },
    ],
  };
}

export function mapProjectStatus(input: {
  fielderName: string | null;
  fieldingStatus?: string;
  dataStatus?: string;
  submitted?: string;
}): ProjectImportStatus {
  const submitted = input.submitted?.trim().toLowerCase();
  const fielding = input.fieldingStatus?.trim().toLowerCase();
  const data = input.dataStatus?.trim().toLowerCase();

  if (submitted === "submitted") return "invoiced";
  if (fielding === "completed" && data === "completed") return "complete";
  if (fielding === "completed" || data === "completed") return "complete";
  if (input.fielderName?.trim()) return "assigned";
  return "draft";
}

export function mapAssignmentStatus(
  fielderName: string | null,
  fieldingStatus?: string
): AssignmentImportStatus | null {
  if (!fielderName?.trim()) return null;
  const fielding = fieldingStatus?.trim().toLowerCase();
  if (fielding === "completed") return "complete";
  return "assigned";
}

export function buildFielderLookup(fielders: FielderLookupRecord[]) {
  const byFullName = new Map<string, FielderLookupRecord>();
  const byFirstName = new Map<string, FielderLookupRecord[]>();

  for (const fielder of fielders) {
    const full = `${fielder.firstName} ${fielder.lastName}`.toLowerCase().trim();
    byFullName.set(full, fielder);
    const first = fielder.firstName.toLowerCase().trim();
    const list = byFirstName.get(first) ?? [];
    list.push(fielder);
    byFirstName.set(first, list);
  }

  return { byFullName, byFirstName };
}

export function matchFielderName(
  rawName: string,
  lookup: ReturnType<typeof buildFielderLookup>
): { fielder: FielderLookupRecord | null; issues: ImportIssue[] } {
  const trimmed = rawName.trim();
  if (!trimmed) return { fielder: null, issues: [] };

  const issues: ImportIssue[] = [];
  const parts = trimmed.split("/").map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const lower = part.toLowerCase();
    const direct = lookup.byFullName.get(lower);
    if (direct) {
      if (parts.length > 1) {
        issues.push({
          level: "warning",
          code: "split_fielder",
          message: `Multiple names in fielder cell — matched "${part}"`,
        });
      }
      return { fielder: direct, issues };
    }

    const tokens = part.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      const full = tokens.join(" ").toLowerCase();
      const multi = lookup.byFullName.get(full);
      if (multi) return { fielder: multi, issues };
    }

    const first = tokens[0]?.toLowerCase();
    if (!first) continue;
    const matches = lookup.byFirstName.get(first) ?? [];
    if (matches.length === 1) {
      if (parts.length > 1) {
        issues.push({
          level: "warning",
          code: "split_fielder",
          message: `Matched "${part}" as ${matches[0].firstName} ${matches[0].lastName}`,
        });
      }
      return { fielder: matches[0], issues };
    }
    if (matches.length > 1) {
      issues.push({
        level: "warning",
        code: "ambiguous_fielder",
        message: `Multiple active fielders named "${tokens[0]}" — assign manually after import`,
      });
    }
  }

  issues.push({
    level: "warning",
    code: "fielder_not_found",
    message: `Fielder not found: "${trimmed}" — project will import without assignment`,
  });
  return { fielder: null, issues };
}

function cell(row: string[], indexByField: Map<string, number>, field: string): string {
  const idx = indexByField.get(field);
  if (idx === undefined) return "";
  return row[idx]?.trim() ?? "";
}

function isEmptyDataRow(row: string[]): boolean {
  return row.every((c) => !c.trim());
}

function normalizeProjectNumber(value: string): string {
  return value.trim();
}

function buildNotes(input: {
  aerial: boolean;
  aerialSqft: number | null;
  buriedSqft: number | null;
  rawNotes: string;
  fieldingStatus: string;
  dataStatus: string;
  submitted: string;
}): string | null {
  const chunks: string[] = [];
  if (input.rawNotes.trim()) chunks.push(input.rawNotes.trim());
  if (input.buriedSqft != null || input.aerialSqft != null) {
    const parts: string[] = [];
    if (input.buriedSqft != null) parts.push(`Buried: ${input.buriedSqft.toLocaleString()} SQFT`);
    if (input.aerialSqft != null) parts.push(`Aerial: ${input.aerialSqft.toLocaleString()} SQFT`);
    chunks.push(parts.join(" · "));
  } else if (input.aerial) {
    chunks.push("Aerial: yes");
  }
  const meta: string[] = [];
  if (input.fieldingStatus) meta.push(`Fielding: ${input.fieldingStatus}`);
  if (input.dataStatus) meta.push(`Data: ${input.dataStatus}`);
  if (input.submitted) meta.push(`Submitted: ${input.submitted}`);
  if (meta.length) chunks.push(meta.join(" · "));
  return chunks.length ? chunks.join("\n") : null;
}

function normalizeTrackerRow(
  rowNumber: number,
  row: string[],
  indexByField: Map<string, number>,
  fielderLookup: ReturnType<typeof buildFielderLookup>
): NormalizedImportRow {
  const issues: ImportIssue[] = [];
  const projectNumber = normalizeProjectNumber(cell(row, indexByField, "projectNumber"));

  if (!projectNumber) {
    return {
      rowNumber,
      projectNumber: "",
      sqft: 0,
      buriedSqft: null,
      aerialSqft: null,
      qfield: null,
      aerial: false,
      dueDate: null,
      siteAddress: "—",
      city: null,
      state: null,
      zip: null,
      fielderName: null,
      fielderId: null,
      projectStatus: "draft",
      assignmentStatus: null,
      notes: null,
      issues: [{ level: "error", code: "missing_project_number", message: "Project ID is required" }],
      importable: false,
    };
  }

  const sqft = parseSqft(cell(row, indexByField, "sqft"));
  if (sqft === null) {
    issues.push({ level: "error", code: "invalid_sqft", message: "SQFT must be a valid number" });
  } else if (sqft <= 0) {
    issues.push({ level: "error", code: "zero_sqft", message: "SQFT must be greater than zero for billing" });
  }

  const qfield = parseQfield(cell(row, indexByField, "qfield"));
  const aerialRaw = cell(row, indexByField, "aerial");
  const aerialSqftParsed = parseSqft(aerialRaw);
  const aerialFlag =
    aerialRaw === "1" ||
    aerialRaw.toLowerCase() === "yes" ||
    aerialRaw.toLowerCase() === "true";
  // Sheet "Aerial" may be a yes/no flag (0/1) or an aerial SQFT amount (e.g. 5000).
  const aerialSqft =
    aerialSqftParsed !== null && aerialSqftParsed > 1
      ? aerialSqftParsed
      : aerialFlag
        ? null
        : aerialSqftParsed !== null && aerialSqftParsed > 0
          ? aerialSqftParsed
          : null;
  const aerial = aerialFlag || (aerialSqft !== null && aerialSqft > 0);

  const buriedRaw = cell(row, indexByField, "buriedSqft");
  const buriedSqftParsed = parseSqft(buriedRaw);
  const buriedSqft =
    buriedSqftParsed !== null && buriedSqftParsed > 0 ? buriedSqftParsed : null;

  const addressParts = parseSiteAddress(cell(row, indexByField, "address"), qfield);
  issues.push(...addressParts.warnings);

  const dueDate = parseImportDate(cell(row, indexByField, "ecd"));
  if (cell(row, indexByField, "ecd") && !dueDate) {
    issues.push({ level: "warning", code: "invalid_date", message: "ECD date could not be parsed" });
  }

  const fielderName = cell(row, indexByField, "fielder") || null;
  const fieldingStatus = cell(row, indexByField, "fieldingStatus");
  const dataStatus = cell(row, indexByField, "dataStatus");
  const submitted = cell(row, indexByField, "submitted");

  let fielderId: string | null = null;
  if (fielderName) {
    const match = matchFielderName(fielderName, fielderLookup);
    fielderId = match.fielder?.id ?? null;
    issues.push(...match.issues);
  }

  const projectStatus = mapProjectStatus({ fielderName, fieldingStatus, dataStatus, submitted });
  const assignmentStatus = mapAssignmentStatus(fielderName, fieldingStatus);

  const notes = buildNotes({
    aerial,
    aerialSqft,
    buriedSqft,
    rawNotes: cell(row, indexByField, "notes"),
    fieldingStatus,
    dataStatus,
    submitted,
  });

  const hasError = issues.some((i) => i.level === "error");

  return {
    rowNumber,
    projectNumber,
    sqft: sqft ?? 0,
    buriedSqft,
    aerialSqft,
    qfield,
    aerial,
    dueDate,
    siteAddress: addressParts.siteAddress,
    city: addressParts.city,
    state: addressParts.state,
    zip: addressParts.zip,
    fielderName,
    fielderId,
    projectStatus,
    assignmentStatus,
    notes,
    issues,
    importable: !hasError,
  };
}

export function parseProjectImportSheet(
  text: string,
  fielders: FielderLookupRecord[] = []
): ImportParseSummary {
  const rawRows = parseSheetRows(text);
  if (rawRows.length === 0) {
    return {
      format: "unknown",
      headers: [],
      rows: [],
      duplicateProjectNumbers: [],
      stats: { total: 0, importable: 0, errors: 0, warnings: 0, skippedEmpty: 0 },
    };
  }

  const [headerRow, ...dataRows] = rawRows;
  const { format, indexByField } = mapHeaders(headerRow);
  const fielderLookup = buildFielderLookup(fielders);

  let skippedEmpty = 0;
  const rows: NormalizedImportRow[] = [];

  if (format === "unknown") {
    return {
      format,
      headers: headerRow,
      rows: [],
      duplicateProjectNumbers: [],
      stats: { total: 0, importable: 0, errors: 1, warnings: 0, skippedEmpty: 0 },
    };
  }

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (isEmptyDataRow(row)) {
      skippedEmpty++;
      continue;
    }
    rows.push(normalizeTrackerRow(i + 2, row, indexByField, fielderLookup));
  }

  const seen = new Map<string, number>();
  const duplicateProjectNumbers: string[] = [];
  for (const row of rows) {
    if (!row.projectNumber) continue;
    const key = row.projectNumber.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 2) duplicateProjectNumbers.push(row.projectNumber);
  }

  for (const row of rows) {
    if (duplicateProjectNumbers.some((d) => d.toLowerCase() === row.projectNumber.toLowerCase())) {
      row.issues.push({
        level: "error",
        code: "duplicate_in_file",
        message: `Duplicate project number in file: ${row.projectNumber}`,
      });
      row.importable = false;
    }
  }

  const importable = rows.filter((r) => r.importable).length;
  const errors = rows.reduce((n, r) => n + r.issues.filter((i) => i.level === "error").length, 0);
  const warnings = rows.reduce((n, r) => n + r.issues.filter((i) => i.level === "warning").length, 0);

  return {
    format,
    headers: headerRow,
    rows,
    duplicateProjectNumbers,
    stats: {
      total: rows.length,
      importable,
      errors,
      warnings,
      skippedEmpty,
    },
  };
}

/** Legacy tabular import (Project #, Client, Title, ...) — used when sheet has Client column */
export interface LegacyImportRow {
  rowNumber: number;
  projectNumber: string;
  client: string;
  title: string;
  sqft: number;
  qfield: number | null;
  address: string;
  state: string | null;
  ecd: string | null;
  issues: ImportIssue[];
  importable: boolean;
}

export function parseLegacyImportSheet(text: string): { rows: LegacyImportRow[]; format: "legacy" | "unknown" } {
  const rawRows = parseSheetRows(text);
  if (rawRows.length < 2) return { rows: [], format: "unknown" };

  const [headerRow, ...dataRows] = rawRows;
  const { format, indexByField } = mapHeaders(headerRow);
  if (format !== "legacy") return { rows: [], format: "unknown" };

  const rows: LegacyImportRow[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (isEmptyDataRow(row)) continue;

    const issues: ImportIssue[] = [];
    const projectNumber = cell(row, indexByField, "projectNumber");
    const client = cell(row, indexByField, "client");

    if (!projectNumber) {
      issues.push({ level: "error", code: "missing_project_number", message: "Project # is required" });
    }
    if (!client) {
      issues.push({ level: "error", code: "missing_client", message: "Client is required" });
    }

    const sqft = parseSqft(cell(row, indexByField, "sqft")) ?? 0;
    if (sqft <= 0) {
      issues.push({ level: "error", code: "zero_sqft", message: "SQFT must be greater than zero" });
    }

    rows.push({
      rowNumber: i + 2,
      projectNumber,
      client,
      title: cell(row, indexByField, "title") || projectNumber,
      sqft,
      qfield: parseQfield(cell(row, indexByField, "qfield")),
      address: cell(row, indexByField, "address"),
      state: normalizeStateCode(cell(row, indexByField, "state")),
      ecd: parseImportDate(cell(row, indexByField, "ecd")),
      issues,
      importable: !issues.some((x) => x.level === "error"),
    });
  }

  return { rows, format: "legacy" };
}
