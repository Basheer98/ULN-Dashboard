"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@uln/shared";

interface PreviewMatch {
  date: string;
  description: string;
  amount: number;
  side: string;
  confidence: string;
  reason: string;
  matchedTransactionId: string | null;
}

interface PreviewResult {
  format: string;
  parseErrors: string[];
  stats: {
    statementLines: number;
    matched: number;
    unmatched: number;
    exact: number;
    strong: number;
    weak: number;
  };
  matches: PreviewMatch[];
}

export function BankStatementImport({
  reconciliationId,
  disabled,
}: {
  reconciliationId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [clearWeak, setClearWeak] = useState(false);
  const [includeUnmatched, setIncludeUnmatched] = useState(true);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    setMessage(null);
    setError(null);
    const content = await file.text();
    setText(content);
  }

  async function runPreview() {
    if (!text.trim()) {
      setError("Upload a bank CSV or OFX file first");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/v1/finance/reconciliation/${reconciliationId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", statementText: text }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Preview failed");
      return;
    }
    setPreview(data);
  }

  async function applyImport() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    const clearConfidences = clearWeak
      ? (["exact", "strong", "weak"] as const)
      : (["exact", "strong"] as const);

    const res = await fetch(`/api/v1/finance/reconciliation/${reconciliationId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "apply",
        statementText: text,
        clearConfidences,
        includeUnmatchedAsManual: includeUnmatched,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      return;
    }
    setMessage(
      `Imported ${data.added} line(s): ${data.cleared} cleared, ${data.unmatchedManual} unmatched pending review`
    );
    setPreview(null);
    router.refresh();
  }

  if (disabled) return null;

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-semibold text-foreground">Import bank statement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV or OFX/QFX export. Matching uses amount + date (and reference when
          available). Exact/strong matches clear automatically; unmatched lines stay pending.
        </p>
      </div>

      <div className="space-y-2">
        <label className="label" htmlFor="bank-file">
          Statement file
        </label>
        <input
          id="bank-file"
          type="file"
          accept=".csv,.ofx,.qfx,.txt,text/csv,application/x-ofx,application/vnd.intu.qfx"
          onChange={handleFile}
          className="w-full text-sm"
        />
        {fileName && <p className="text-xs text-muted-foreground">Loaded: {fileName}</p>}
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={clearWeak}
            onChange={(e) => setClearWeak(e.target.checked)}
          />
          Also clear weak matches
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeUnmatched}
            onChange={(e) => setIncludeUnmatched(e.target.checked)}
          />
          Add unmatched as manual items
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading || !text}
          onClick={runPreview}
          className="btn-secondary"
        >
          {loading ? "Working…" : "Preview matches"}
        </button>
        <button
          type="button"
          disabled={loading || !preview}
          onClick={applyImport}
          className="btn-primary"
        >
          Apply to reconciliation
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {message && <p className="text-sm text-success">{message}</p>}

      {preview && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <span>{preview.stats.statementLines} statement lines</span>
            <span className="text-success">{preview.stats.matched} matched</span>
            <span className="text-warning">{preview.stats.unmatched} unmatched</span>
            <span className="text-muted-foreground">
              {preview.stats.exact} exact · {preview.stats.strong} strong · {preview.stats.weak}{" "}
              weak
            </span>
          </div>
          {preview.parseErrors.length > 0 && (
            <ul className="text-xs text-warning">
              {preview.parseErrors.slice(0, 5).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="overflow-x-auto">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Match</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {preview.matches.slice(0, 80).map((m, i) => (
                  <tr key={`${m.date}-${i}`}>
                    <td>{m.date}</td>
                    <td>{m.description}</td>
                    <td>{formatCurrency(m.amount)}</td>
                    <td>
                      <span
                        className={
                          m.confidence === "none"
                            ? "text-warning"
                            : m.confidence === "weak"
                              ? "text-warning"
                              : "text-success"
                        }
                      >
                        {m.confidence}
                      </span>
                    </td>
                    <td>{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.matches.length > 80 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Showing first 80 of {preview.matches.length}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
