"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { US_STATES } from "@uln/shared";

const PRESETS = [
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom" },
];

export function ReportsToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [preset, setPreset] = useState(searchParams.get("preset") ?? "month");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [stateFilter, setStateFilter] = useState(searchParams.get("state") ?? "");

  function applyFilters() {
    const params = new URLSearchParams();
    params.set("preset", preset);
    if (preset === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    if (stateFilter) params.set("state", stateFilter);
    router.push(`/reports?${params.toString()}`);
  }

  function exportUrl(path: string) {
    const params = new URLSearchParams(searchParams.toString());
    return `${path}?${params.toString()}`;
  }

  return (
    <div className="card flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Date Range</label>
        <select value={preset} onChange={(e) => setPreset(e.target.value)} className="w-full sm:w-auto sm:min-w-[140px]">
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>
      {preset === "custom" && (
        <>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </>
      )}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">State</label>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="w-full sm:w-auto sm:min-w-[150px]">
          <option value="">All States</option>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
      </div>
      <button type="button" onClick={applyFilters} className="btn-primary">
        Apply
      </button>
      <div className="flex w-full flex-wrap gap-2 lg:ml-auto lg:w-auto">
        <a href={exportUrl("/api/v1/reports/export")} className="btn-secondary text-sm">
          Export CSV
        </a>
        <a href={exportUrl("/api/v1/reports/export?type=pdf")} className="btn-secondary text-sm">
          Export PDF
        </a>
        <a href={exportUrl("/api/v1/reports/quickbooks")} className="btn-secondary text-sm">
          QuickBooks Invoices
        </a>
        <a href={exportUrl("/api/v1/reports/quickbooks?type=payments")} className="btn-secondary text-sm">
          QuickBooks Payments
        </a>
        <a href={exportUrl("/api/v1/reports/quickbooks?type=tax")} className="btn-secondary text-sm">
          1099 / W-2 Summary
        </a>
      </div>
    </div>
  );
}
