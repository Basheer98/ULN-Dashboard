"use client";

import { useState } from "react";

const REPORT_TYPES = [
  { type: "pnl", label: "Profit & Loss" },
  { type: "cashflow", label: "Cash Flow" },
  { type: "income-by-client", label: "Income by Client" },
  { type: "expenses-by-category", label: "Expenses by Category" },
  { type: "expenses-by-vendor", label: "Expenses by Vendor" },
  { type: "expenses-by-project", label: "Expenses by Project" },
  { type: "mileage", label: "Mileage" },
  { type: "owner-draws", label: "Owner Draws" },
  { type: "loans", label: "Loans" },
  { type: "outstanding-invoices", label: "Outstanding Invoices" },
  { type: "receipt-audit", label: "Receipt Audit" },
  { type: "tax-deductible", label: "Tax Deductible" },
  { type: "missing-receipts", label: "Missing Receipts" },
];

export function FinanceReportExports() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function exportUrl(type: string) {
    const params = new URLSearchParams({ type });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/v1/finance/reports/export?${params}`;
  }

  return (
    <div className="space-y-6">
      <div className="card grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label">From Date</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="label">To Date</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full" />
        </div>
        <div className="flex items-end">
          <p className="text-xs text-muted-foreground">
            Leave blank for all-time data. Applies to all exports below.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map((r) => (
          <a
            key={r.type}
            href={exportUrl(r.type)}
            className="card flex items-center justify-between transition hover:border-accent/30"
          >
            <span className="text-sm font-medium text-foreground">{r.label}</span>
            <span className="text-xs text-accent">Export CSV →</span>
          </a>
        ))}
      </div>
    </div>
  );
}
