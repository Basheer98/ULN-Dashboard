"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function StatementControls({
  fielderId,
  month,
  from,
  to,
  canEmail,
}: {
  fielderId: string;
  month: string;
  from?: string;
  to?: string;
  canEmail?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [emailing, setEmailing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mode = from && to ? "range" : "month";

  const query = useMemo(() => {
    if (mode === "range" && from && to) {
      return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    }
    return `month=${encodeURIComponent(month)}`;
  }, [mode, from, to, month]);

  function pushParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    router.push(`/fielders/${fielderId}/statement?${params.toString()}`);
  }

  function setMonth(value: string) {
    pushParams({ month: value, from: undefined, to: undefined });
  }

  function setRange(nextFrom: string, nextTo: string) {
    pushParams({ from: nextFrom, to: nextTo, month: undefined });
  }

  function useThisMonth() {
    const now = new Date();
    const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setMonth(m);
  }

  function useLast30() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    setRange(toIsoDate(start), toIsoDate(end));
  }

  async function emailStatement() {
    setEmailing(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/v1/fielders/${fielderId}/statement/email?${query}`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setEmailing(false);
    if (!res.ok) {
      setError(data.error || "Failed to email statement");
      return;
    }
    setMessage(data.skipped ? "Email skipped (no Resend key — check server logs)" : "Statement emailed");
  }

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Month</label>
          <input
            type="month"
            value={mode === "month" ? month : ""}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">From</label>
          <input
            type="date"
            value={from ?? ""}
            onChange={(e) => {
              const nextFrom = e.target.value;
              const nextTo = to || nextFrom;
              if (nextFrom) setRange(nextFrom, nextTo);
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">To</label>
          <input
            type="date"
            value={to ?? ""}
            onChange={(e) => {
              const nextTo = e.target.value;
              const nextFrom = from || nextTo;
              if (nextTo) setRange(nextFrom, nextTo);
            }}
          />
        </div>
        <button type="button" onClick={useThisMonth} className="btn-secondary text-xs">
          This month
        </button>
        <button type="button" onClick={useLast30} className="btn-secondary text-xs">
          Last 30 days
        </button>
        <button type="button" onClick={() => window.print()} className="btn-secondary">
          Print
        </button>
        <a href={`/api/v1/fielders/${fielderId}/statement?${query}`} className="btn-primary">
          Download PDF
        </a>
        {canEmail ? (
          <button
            type="button"
            disabled={emailing}
            onClick={emailStatement}
            className="btn-secondary"
          >
            {emailing ? "Sending…" : "Email PDF"}
          </button>
        ) : null}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {message && <p className="text-sm text-success">{message}</p>}
    </div>
  );
}
