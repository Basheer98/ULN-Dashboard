"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/layout";
import { InvoiceActions } from "@/components/finance-actions";

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  dueAt: string | null;
  issuedAt: string | null;
  createdAt: string;
  clientName: string;
  projectId: string;
  projectNumber: string;
};

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function InvoicesTable({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allIds = useMemo(() => invoices.map((i) => i.id), [invoices]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkMarkSent() {
    if (selected.size === 0) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/v1/invoices/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), action: "mark_sent" }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Bulk update failed");
      return;
    }
    setSelected(new Set());
    router.refresh();
  }

  function exportSelected() {
    const rows = invoices.filter((i) => selected.has(i.id));
    if (rows.length === 0) return;
    downloadCsv("invoices.csv", [
      ["Invoice", "Client", "Project", "Amount", "Due", "Status", "Issued"],
      ...rows.map((i) => [
        i.invoiceNumber,
        i.clientName,
        i.projectNumber,
        String(i.totalAmount),
        i.dueAt ? new Date(i.dueAt).toLocaleDateString() : "",
        i.status,
        i.issuedAt
          ? new Date(i.issuedAt).toLocaleDateString()
          : new Date(i.createdAt).toLocaleDateString(),
      ]),
    ]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={loading || selected.size === 0}
          onClick={bulkMarkSent}
        >
          Mark sent ({selected.size})
        </button>
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={selected.size === 0}
          onClick={exportSelected}
        >
          Export selected
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all invoices"
                />
              </th>
              <th>Invoice</th>
              <th>Client</th>
              <th>Project</th>
              <th>Amount</th>
              <th>Due</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(inv.id)}
                    onChange={() => toggle(inv.id)}
                    aria-label={`Select ${inv.invoiceNumber}`}
                  />
                </td>
                <td>{inv.invoiceNumber}</td>
                <td>{inv.clientName}</td>
                <td>
                  <Link href={`/projects/${inv.projectId}`} className="link">
                    {inv.projectNumber}
                  </Link>
                </td>
                <td>
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(inv.totalAmount)}
                </td>
                <td className={inv.status === "overdue" ? "text-danger" : ""}>
                  {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "—"}
                </td>
                <td>
                  <StatusBadge status={inv.status} />
                </td>
                <td>
                  <InvoiceActions
                    invoiceId={inv.id}
                    invoiceNumber={inv.invoiceNumber}
                    status={inv.status}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
