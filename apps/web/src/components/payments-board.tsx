"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/layout";
import { PaymentActions } from "@/components/payment-actions";
import { formatCurrency, formatRate } from "@uln/shared";

export type PaymentRow = {
  id: string;
  status: string;
  employmentType: string;
  totalAmount: number;
  amountPaid: number;
  sqftAmount: number;
  lineItemsTotal: number;
  paidAt: string | null;
  referenceNumber: string | null;
  createdAt: string;
  fielderId: string;
  fielderName: string;
  projectId: string | null;
  projectNumber: string | null;
  sqft: number | null;
  rate: number | null;
};

export function PaymentsBoard({
  payments,
  fielders,
  initialFilters,
}: {
  payments: PaymentRow[];
  fielders: { id: string; name: string }[];
  initialFilters: {
    fielderId: string;
    status: string;
    from: string;
    to: string;
    employmentType: string;
    year: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useState(initialFilters);
  const [selected, setSelected] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");

  function applyFilters(next: Partial<typeof filters>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    startTransition(() => {
      router.push(`/payments?${params.toString()}`);
    });
  }

  const unpaid = useMemo(
    () =>
      payments.filter(
        (p) =>
          (p.status === "pending" || p.status === "approved" || p.status === "partial") &&
          p.totalAmount - p.amountPaid > 0.001
      ),
    [payments]
  );
  const unpaidIds = unpaid.map((p) => p.id);
  const unpaidTotal = unpaid.reduce(
    (s, p) => s + Math.max(0, p.totalAmount - p.amountPaid),
    0
  );
  const allSelected = unpaidIds.length > 0 && unpaidIds.every((id) => selected.includes(id));

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    if (!params.get("year") && !params.get("status")) {
      params.set("year", String(new Date().getFullYear()));
      params.set("employmentType", filters.employmentType || "contractor_1099");
      params.set("status", "paid");
    }
    return `/api/v1/payments/export?${params.toString()}`;
  }, [filters]);

  function toggle(id: string, on: boolean) {
    setSelected((prev) => (on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  }

  async function batchPay() {
    if (selected.length === 0) return;
    setBatchLoading(true);
    setError("");
    const res = await fetch("/api/v1/payments/batch-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIds: selected,
        referenceNumber: reference.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBatchLoading(false);
    if (!res.ok) {
      setError(data.error || "Batch pay failed");
      return;
    }
    setSelected([]);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="label">Fielder</label>
          <select
            className="w-full"
            value={filters.fielderId}
            onChange={(e) => applyFilters({ fielderId: e.target.value })}
          >
            <option value="">All</option>
            {fielders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="w-full"
            value={filters.status}
            onChange={(e) => applyFilters({ status: e.target.value })}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select
            className="w-full"
            value={filters.employmentType}
            onChange={(e) => applyFilters({ employmentType: e.target.value })}
          >
            <option value="">All</option>
            <option value="contractor_1099">1099</option>
            <option value="w2">W-2</option>
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input
            type="date"
            className="w-full"
            value={filters.from}
            onChange={(e) => applyFilters({ from: e.target.value })}
          />
        </div>
        <div>
          <label className="label">To</label>
          <input
            type="date"
            className="w-full"
            value={filters.to}
            onChange={(e) => applyFilters({ to: e.target.value })}
          />
        </div>
        <div className="flex items-end">
          <a href={exportHref} className="btn-secondary w-full text-center text-sm">
            Export CSV (1099)
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => setSelected(e.target.checked ? unpaidIds : [])}
            disabled={unpaidIds.length === 0}
          />
          Select unpaid ({unpaidIds.length})
        </label>
        <input
          className="max-w-xs flex-1"
          placeholder="Batch reference (optional)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={batchLoading || selected.length === 0 || pending}
          onClick={batchPay}
        >
          {batchLoading ? "Paying..." : `Mark ${selected.length} paid`}
        </button>
        <span className="text-xs text-muted-foreground">
          Unpaid in view: {formatCurrency(unpaidTotal)}
        </span>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>

      {payments.length === 0 ? (
        <div className="card text-center text-sm text-muted-foreground">
          No payments match these filters. Complete a project to auto-generate payables, or clear
          filters.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>Fielder</th>
                <th>Type</th>
                <th>Project</th>
                <th>SQFT</th>
                <th>Rate</th>
                <th>SQFT pay</th>
                <th>Extras</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const remaining = Math.max(0, p.totalAmount - p.amountPaid);
                const unpaidRow =
                  (p.status === "pending" ||
                    p.status === "approved" ||
                    p.status === "partial") &&
                  remaining > 0.001;
                return (
                  <tr key={p.id}>
                    <td>
                      {unpaidRow ? (
                        <input
                          type="checkbox"
                          checked={selected.includes(p.id)}
                          onChange={(e) => toggle(p.id, e.target.checked)}
                        />
                      ) : null}
                    </td>
                    <td>
                      <Link href={`/fielders/${p.fielderId}`} className="link">
                        {p.fielderName}
                      </Link>
                    </td>
                    <td>{p.employmentType === "w2" ? "W-2" : "1099"}</td>
                    <td>
                      {p.projectId && p.projectNumber ? (
                        <Link href={`/projects/${p.projectId}`} className="link">
                          {p.projectNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{p.sqft != null ? p.sqft.toLocaleString() : "—"}</td>
                    <td>{p.rate != null ? `${formatRate(p.rate)}/SQFT` : "—"}</td>
                    <td>{formatCurrency(p.sqftAmount)}</td>
                    <td>{formatCurrency(p.lineItemsTotal)}</td>
                    <td className="font-medium">{formatCurrency(p.totalAmount)}</td>
                    <td>{formatCurrency(p.amountPaid)}</td>
                    <td className={remaining > 0 ? "text-warning" : "text-success"}>
                      {formatCurrency(remaining)}
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                      {p.paidAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(p.paidAt).toLocaleDateString()}
                          {p.referenceNumber ? ` · ${p.referenceNumber}` : ""}
                        </p>
                      )}
                    </td>
                    <td>
                      <PaymentActions
                        paymentId={p.id}
                        status={p.status}
                        totalAmount={p.totalAmount}
                        amountPaid={p.amountPaid}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
