"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReceiptVerifyActions({
  receiptId,
  status,
}: {
  receiptId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (status !== "pending") return null;

  async function verify(action: "verified" | "rejected") {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/v1/finance/receipts/${receiptId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        reason: action === "rejected" ? reason : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Verification failed");
      return;
    }
    setShowReject(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={() => verify("verified")}
        className="btn-primary text-xs"
      >
        Verify
      </button>
      {!showReject ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => setShowReject(true)}
          className="btn-secondary text-xs"
        >
          Reject
        </button>
      ) : (
        <>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason"
            className="min-w-[140px]"
          />
          <button
            type="button"
            disabled={loading || !reason.trim()}
            onClick={() => verify("rejected")}
            className="btn-secondary text-xs"
          >
            Confirm
          </button>
          <button type="button" onClick={() => setShowReject(false)} className="btn-ghost text-xs">
            Cancel
          </button>
        </>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

export function ExpenseReceiptUpload({
  expenseId,
  projectId,
}: {
  expenseId: string;
  projectId?: string | null;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("transactionId", expenseId);
      if (projectId) form.append("projectId", projectId);

      const res = await fetch("/api/v1/finance/receipts", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2 sm:max-w-sm sm:text-right">
      <label className="btn-secondary inline-flex cursor-pointer items-center justify-center text-sm">
        {uploading ? "Uploading…" : "Attach receipt"}
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={handleFile}
          disabled={uploading}
          className="sr-only"
        />
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function BatchReimbursePanel({
  expenses,
}: {
  expenses: Array<{
    id: string;
    transactionNumber: string;
    amount: number;
    description: string | null;
    fielderName: string | null;
  }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (expenses.length === 0) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === expenses.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(expenses.map((e) => e.id)));
    }
  }

  async function runBatch() {
    if (selected.size === 0) return;
    setLoading(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/v1/finance/expenses/reimburse-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Batch reimburse failed");
      return;
    }
    setMessage(
      `Reimbursed ${data.reimbursedCount} expense${data.reimbursedCount === 1 ? "" : "s"}${
        data.skippedCount ? ` (${data.skippedCount} skipped)` : ""
      }.`
    );
    setSelected(new Set());
    router.refresh();
  }

  const total = expenses
    .filter((e) => selected.has(e.id))
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Batch reimburse</h2>
          <p className="text-sm text-muted-foreground">
            Approved reimbursable expenses ready to mark paid
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={toggleAll} className="btn-ghost text-xs">
            {selected.size === expenses.length ? "Clear" : "Select all"}
          </button>
          <button
            type="button"
            disabled={loading || selected.size === 0}
            onClick={runBatch}
            className="btn-primary text-xs"
          >
            {loading
              ? "Processing…"
              : selected.size === 0
                ? "Reimburse selected"
                : `Reimburse ${selected.size} ($${total.toFixed(2)})`}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Number</th>
              <th>Fielder</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(exp.id)}
                    onChange={() => toggle(exp.id)}
                  />
                </td>
                <td>{exp.transactionNumber}</td>
                <td>{exp.fielderName || "—"}</td>
                <td>{exp.description || "—"}</td>
                <td>${exp.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message && <p className="text-sm text-accent">{message}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
