"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout";
import { formatCurrency } from "@uln/shared";

interface ClientOption {
  id: string;
  name: string;
}

interface PreviewIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

interface PreviewRow {
  rowNumber: number;
  projectNumber: string;
  sqft: number;
  state: string | null;
  fielderName: string | null;
  projectStatus: string;
  action: "create" | "update" | "skip";
  importable: boolean;
  clientSqftRate: number;
  estimatedClientTotal: number;
  estimatedFielderTotal: number | null;
  blockedReason: string | null;
  issues: PreviewIssue[];
}

interface PreviewResult {
  format: "tracker" | "legacy" | "unknown";
  rows?: PreviewRow[];
  canImport: boolean;
  blockers: string[];
  duplicateProjectNumbers?: string[];
  stats?: {
    total: number;
    importable: number;
    toCreate: number;
    toUpdate: number;
    blocked: number;
    errors: number;
    warnings: number;
    skippedEmpty: number;
    estimatedClientRevenue: number;
  };
  legacyRows?: Array<{
    rowNumber: number;
    projectNumber: string;
    client: string;
    sqft: number;
    importable: boolean;
    issues: PreviewIssue[];
  }>;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errored: number;
  results: Array<{ row: number; projectNumber: string; status: string; message?: string }>;
}

function statusClass(level: "error" | "warning") {
  return level === "error" ? "text-danger" : "text-warning";
}

export default function ImportProjectsPage() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [defaultClientId, setDefaultClientId] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetStatus, setSheetStatus] = useState<{
    ready: boolean;
    hasCredentials: boolean;
    configured: boolean;
    serviceAccountEmail: string | null;
    spreadsheetId: string | null;
    tabName: string | null;
  } | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetSource, setSheetSource] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/clients")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : ((data.clients ?? []) as ClientOption[]);
        setClients(list);
        if (list.length === 1) setDefaultClientId(list[0].id);
      })
      .catch(() => setError("Could not load clients"));
  }, []);

  useEffect(() => {
    fetch("/api/v1/projects/import/sheet")
      .then((r) => r.json())
      .then(setSheetStatus)
      .catch(() => setSheetStatus(null));
  }, []);

  const hasText = raw.trim().length > 0;

  async function pullFromGoogleSheet() {
    if (!defaultClientId) {
      setError("Select a billing client before pulling from Google Sheets");
      return;
    }
    setSheetLoading(true);
    setError(null);
    setResult(null);
    setAcknowledgeWarnings(false);

    const res = await fetch("/api/v1/projects/import/sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fetch", defaultClientId }),
    });
    const data = await res.json();
    setSheetLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Could not pull from Google Sheet");
      return;
    }

    setRaw(data.text);
    setFileName(null);
    setSheetSource(
      `Google Sheet · ${data.meta.tabName} · ${data.meta.rowCount} rows · ${new Date(data.meta.fetchedAt).toLocaleString()}`
    );
  }

  const runPreview = useCallback(async () => {
    if (!hasText) return;
    setPreviewLoading(true);
    setError(null);
    setResult(null);
    setAcknowledgeWarnings(false);

    const res = await fetch("/api/v1/projects/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: raw,
        defaultClientId,
        updateExisting,
      }),
    });
    const data = await res.json();
    setPreviewLoading(false);

    if (!res.ok) {
      setPreview(null);
      setError(data.error ?? "Preview failed");
      return;
    }
    setPreview(data);
  }, [raw, defaultClientId, updateExisting, hasText]);

  useEffect(() => {
    if (!hasText || !defaultClientId) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      void runPreview();
    }, 400);
    return () => clearTimeout(timer);
  }, [raw, defaultClientId, updateExisting, hasText, runPreview]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSheetSource(null);
    const reader = new FileReader();
    reader.onload = () => {
      setRaw(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  const trackerRows = preview?.rows ?? [];
  const warningCount = preview?.stats?.warnings ?? 0;
  const needsWarningAck = warningCount > 0 && !acknowledgeWarnings;

  const canImport = useMemo(() => {
    if (!preview?.canImport) return false;
    if (preview.format === "legacy") return true;
    if (!defaultClientId) return false;
    if (needsWarningAck) return false;
    return true;
  }, [preview, defaultClientId, needsWarningAck]);

  async function handleImport() {
    if (!canImport) return;
    setImportLoading(true);
    setError(null);

    const res = await fetch("/api/v1/projects/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: raw,
        defaultClientId: preview?.format === "legacy" ? undefined : defaultClientId,
        updateExisting,
        acknowledgeWarnings: acknowledgeWarnings || warningCount === 0,
      }),
    });
    const data = await res.json();
    setImportLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Import failed");
      return;
    }
    setResult(data);
    router.refresh();
    void runPreview();
  }

  return (
    <>
      <Header
        title="Import Projects"
        subtitle="Upload your project tracker CSV or paste from Google Sheets"
      />
      <main className="page-main space-y-6">
        <div className="card space-y-3">
          <h2 className="font-semibold text-foreground">Operations import</h2>
          <p className="text-sm text-muted-foreground">
            Supports your tracker columns: Project ID, Qfield, SQFT, ECD, Address, Feilder,
            statuses, and Notes. SQFT must be greater than zero. Duplicate project numbers in
            the same file block import. Invoiced/paid projects are never overwritten.
          </p>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold text-foreground">Google Sheet sync</h2>
          {sheetStatus?.ready ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Pull live data from your configured tracker sheet ({sheetStatus.spreadsheetId}
                {sheetStatus.tabName ? ` · tab ${sheetStatus.tabName}` : ""}). Review the preview
                before importing — same validation as CSV upload.
              </p>
              <button
                type="button"
                disabled={sheetLoading || !defaultClientId}
                onClick={pullFromGoogleSheet}
                className="btn-secondary"
              >
                {sheetLoading ? "Pulling…" : "Pull from Google Sheet"}
              </button>
              {sheetSource && (
                <p className="text-xs text-muted-foreground">Last pulled: {sheetSource}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Connect your project tracker sheet to pull updates without exporting CSV.
              </p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Enable <strong>Google Sheets API</strong> in Google Cloud</li>
                <li>
                  Share the sheet with{" "}
                  <code className="text-xs">
                    {sheetStatus?.serviceAccountEmail ?? "your service account email"}
                  </code>{" "}
                  as Viewer
                </li>
                <li>
                  Set <code className="text-xs">GOOGLE_SHEETS_SPREADSHEET_ID</code> in{" "}
                  <code className="text-xs">.env</code> and restart the server
                </li>
              </ol>
              {!sheetStatus?.hasCredentials && (
                <p className="text-warning">
                  Google service account credentials are not configured yet.
                </p>
              )}
              {sheetStatus?.hasCredentials && !sheetStatus.configured && (
                <p className="text-warning">
                  Credentials found — add GOOGLE_SHEETS_SPREADSHEET_ID to enable sync.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="label" htmlFor="billing-client">
                Billing client (required)
              </label>
              <select
                id="billing-client"
                value={defaultClientId}
                onChange={(e) => setDefaultClientId(e.target.value)}
                className="w-full"
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Your tracker has no Client column — all projects bill to this client.
              </p>
            </div>

            <div className="space-y-2">
              <label className="label" htmlFor="csv-file">
                Upload CSV
              </label>
              <input
                id="csv-file"
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleFileChange}
                className="w-full text-sm"
              />
              {fileName && (
                <p className="text-xs text-muted-foreground">Loaded: {fileName}</p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
            />
            Update existing projects (sync changes from sheet)
          </label>

          <div className="space-y-2">
            <label className="label">Or paste rows (CSV / tab-separated)</label>
            <textarea
              value={raw}
              onChange={(e) => {
                setFileName(null);
                setSheetSource(null);
                setRaw(e.target.value);
              }}
              rows={6}
              placeholder="Paste from Google Sheets or drop a CSV above"
              className="w-full font-mono text-xs"
            />
          </div>
        </div>

        {previewLoading && (
          <p className="text-sm text-muted-foreground">Validating import…</p>
        )}

        {error && (
          <div className="card border-danger/30 bg-danger/5 text-sm text-danger">{error}</div>
        )}

        {preview && preview.format === "unknown" && (
          <div className="card text-sm text-danger">
            Unrecognized format. Include headers like Project ID, Qfield, SQFT, Address, Feilder.
          </div>
        )}

        {preview && preview.blockers.length > 0 && (
          <div className="card border-danger/30 bg-danger/5 space-y-2">
            <h3 className="text-sm font-semibold text-danger">Import blocked</h3>
            <ul className="list-disc pl-5 text-sm text-danger">
              {preview.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}

        {preview?.stats && preview.format === "tracker" && (
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Preview summary</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>{preview.stats.total} rows</span>
              <span className="text-success">{preview.stats.toCreate} to create</span>
              <span className="text-primary">{preview.stats.toUpdate} to update</span>
              <span className="text-warning">{preview.stats.blocked} skipped</span>
              <span className="text-danger">{preview.stats.errors} errors</span>
              <span className="text-warning">{preview.stats.warnings} warnings</span>
              {preview.stats.skippedEmpty > 0 && (
                <span className="text-muted-foreground">
                  {preview.stats.skippedEmpty} empty rows ignored
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Estimated new client revenue:{" "}
              <strong>{formatCurrency(preview.stats.estimatedClientRevenue)}</strong>
            </p>
          </div>
        )}

        {trackerRows.length > 0 && (
          <div className="card overflow-x-auto">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Row preview</h3>
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Project</th>
                  <th>SQFT</th>
                  <th>State</th>
                  <th>Fielder</th>
                  <th>Status</th>
                  <th>Action</th>
                  <th>Client $</th>
                  <th>Issues</th>
                </tr>
              </thead>
              <tbody>
                {trackerRows.slice(0, 100).map((r) => (
                  <tr key={r.rowNumber} className={!r.importable ? "opacity-60" : undefined}>
                    <td>{r.rowNumber}</td>
                    <td>{r.projectNumber}</td>
                    <td>{r.sqft.toLocaleString()}</td>
                    <td>{r.state ?? "—"}</td>
                    <td>{r.fielderName ?? "—"}</td>
                    <td>{r.projectStatus}</td>
                    <td>{r.action}</td>
                    <td>{formatCurrency(r.estimatedClientTotal)}</td>
                    <td>
                      {r.blockedReason && (
                        <span className="text-warning">{r.blockedReason}</span>
                      )}
                      {r.issues.map((issue) => (
                        <div key={issue.code + issue.message} className={statusClass(issue.level)}>
                          {issue.message}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {trackerRows.length > 100 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing first 100 of {trackerRows.length}.
              </p>
            )}
          </div>
        )}

        {warningCount > 0 && preview?.canImport && (
          <div className="card border-warning/30 bg-warning/5 space-y-2">
            <p className="text-sm text-warning">
              {warningCount} warning(s) — review fielder matches and addresses before importing.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={acknowledgeWarnings}
                onChange={(e) => setAcknowledgeWarnings(e.target.checked)}
              />
              I reviewed warnings and want to proceed
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={importLoading || !canImport}
            onClick={handleImport}
            className="btn-primary"
          >
            {importLoading
              ? "Importing…"
              : preview?.stats
                ? `Import ${preview.stats.importable} project(s)`
                : "Import"}
          </button>
          <button type="button" onClick={() => router.push("/projects")} className="btn-secondary">
            Back to Projects
          </button>
        </div>

        {result && (
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Import results</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-success">{result.created} created</span>
              <span className="text-primary">{result.updated} updated</span>
              <span className="text-warning">{result.skipped} skipped</span>
              <span className="text-danger">{result.errored} errored</span>
            </div>
            {(result.skipped > 0 || result.errored > 0) && (
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {result.results
                  .filter((r) => r.status !== "created" && r.status !== "updated")
                  .map((r) => (
                    <li key={`${r.row}-${r.projectNumber}`}>
                      Row {r.row} ({r.projectNumber || "—"}): {r.status} — {r.message}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </>
  );
}
