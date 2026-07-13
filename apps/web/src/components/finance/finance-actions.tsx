"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ExpenseActions({
  expenseId,
  status,
}: {
  expenseId: string;
  status: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  async function postAction(path: string, body?: object) {
    setLoading(true);
    const res = await fetch(`/api/v1/finance/expenses/${expenseId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    setLoading(false);
    if (res.ok) {
      setShowReject(false);
      router.refresh();
    }
  }

  const s = status ?? "draft";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(s === "submitted" || s === "pending_review") && (
        <button
          type="button"
          disabled={loading}
          onClick={() => postAction("approve")}
          className="btn-primary text-xs"
        >
          Approve
        </button>
      )}
      {(s === "submitted" || s === "pending_review" || s === "approved") && !showReject && (
        <button
          type="button"
          disabled={loading}
          onClick={() => setShowReject(true)}
          className="btn-secondary text-xs"
        >
          Reject
        </button>
      )}
      {s === "approved" && (
        <button
          type="button"
          disabled={loading}
          onClick={() => postAction("reimburse")}
          className="btn-primary text-xs"
        >
          Mark Reimbursed
        </button>
      )}
      {showReject && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason"
            className="min-w-[160px]"
          />
          <button
            type="button"
            disabled={loading || !reason.trim()}
            onClick={() => postAction("reject", { reason })}
            className="btn-secondary text-xs"
          >
            Confirm Reject
          </button>
          <button type="button" onClick={() => setShowReject(false)} className="btn-ghost text-xs">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function MileageActions({
  mileageId,
  status,
}: {
  mileageId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  async function postAction(path: string, body?: object) {
    setLoading(true);
    const res = await fetch(`/api/v1/finance/mileage/${mileageId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    setLoading(false);
    if (res.ok) {
      setShowReject(false);
      router.refresh();
    }
  }

  const s = status ?? "submitted";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(s === "submitted" || s === "pending_review") && (
        <button
          type="button"
          disabled={loading}
          onClick={() => postAction("approve")}
          className="btn-primary text-xs"
        >
          Approve
        </button>
      )}
      {(s === "submitted" || s === "pending_review" || s === "approved") && !showReject && (
        <button
          type="button"
          disabled={loading}
          onClick={() => setShowReject(true)}
          className="btn-secondary text-xs"
        >
          Reject
        </button>
      )}
      {s === "approved" && (
        <button
          type="button"
          disabled={loading}
          onClick={() => postAction("reimburse")}
          className="btn-primary text-xs"
        >
          Mark Reimbursed
        </button>
      )}
      {showReject && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Rejection reason"
            className="min-w-[140px]"
          />
          <button
            type="button"
            disabled={loading || !reason.trim()}
            onClick={() => postAction("reject", { reason })}
            className="btn-secondary text-xs"
          >
            Confirm
          </button>
          <button type="button" onClick={() => setShowReject(false)} className="btn-ghost text-xs">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function ReconciliationActions({
  reconciliationId,
  status,
  difference,
}: {
  reconciliationId: string;
  status: string;
  difference: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function complete() {
    setLoading(true);
    await fetch(`/api/v1/finance/reconciliation/${reconciliationId}/complete`, {
      method: "POST",
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "in_progress" && Math.abs(difference) < 0.01 && (
        <button type="button" disabled={loading} onClick={complete} className="btn-primary text-sm">
          Complete Reconciliation
        </button>
      )}
      <span className="text-sm text-muted-foreground">
        {Math.abs(difference) < 0.01 ? "Balanced" : `Difference: $${difference.toFixed(2)}`}
      </span>
    </div>
  );
}

export function ReconciliationItemToggle({
  reconciliationId,
  itemId,
  isCleared,
}: {
  reconciliationId: string;
  itemId: string;
  isCleared: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    await fetch(`/api/v1/finance/reconciliation/${reconciliationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, isCleared: !isCleared }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <button type="button" disabled={loading} onClick={toggle} className="btn-secondary text-xs">
      {isCleared ? "Unclear" : "Clear"}
    </button>
  );
}

export function RecordInvoicePaymentForm({
  invoices,
  paymentMethods,
}: {
  invoices: { id: string; label: string; remaining: number }[];
  paymentMethods: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [invoiceId, setInvoiceId] = useState(invoices[0]?.id ?? "");
  const selected = invoices.find((i) => i.id === invoiceId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/v1/finance/invoice-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: form.get("invoiceId"),
        amount: Number(form.get("amount")),
        paidAt: form.get("paidAt"),
        paymentMethodId: form.get("paymentMethodId") || null,
        reference: form.get("reference") || undefined,
        writeOffRemainder: form.get("writeOffRemainder") === "on",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to record payment");
      setLoading(false);
      return;
    }
    e.currentTarget.reset();
    router.refresh();
    setLoading(false);
  }

  if (invoices.length === 0) return null;

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h2 className="font-semibold text-foreground">Record Invoice Payment</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Invoice *</label>
          <select
            name="invoiceId"
            required
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            className="w-full"
          >
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.label} — ${inv.remaining.toFixed(2)} remaining
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Amount *</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={selected?.remaining.toFixed(2)}
            key={invoiceId}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Paid Date *</label>
          <input
            name="paidAt"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Payment Method</label>
          <select name="paymentMethodId" className="w-full">
            <option value="">—</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Reference</label>
          <input name="reference" placeholder="Check #, wire ref, etc." className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input name="writeOffRemainder" type="checkbox" />
            Write off remaining balance after payment
          </label>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "Saving..." : "Record Payment"}
      </button>
    </form>
  );
}

export function LoanPaymentForm({
  loanId,
  defaultAmount,
}: {
  loanId: string;
  defaultAmount?: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/v1/finance/loans/${loanId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paidAt: form.get("paidAt"),
        principalAmount: Number(form.get("principalAmount")),
        interestAmount: Number(form.get("interestAmount") || 0),
        feeAmount: Number(form.get("feeAmount") || 0),
        reference: form.get("reference") || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to record payment");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="font-semibold text-foreground">Record Loan Payment</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Paid Date *</label>
          <input
            name="paidAt"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Principal *</label>
          <input
            name="principalAmount"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={defaultAmount?.toFixed(2) ?? ""}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Interest</label>
          <input name="interestAmount" type="number" step="0.01" min="0" defaultValue="0" className="w-full" />
        </div>
        <div>
          <label className="label">Fees</label>
          <input name="feeAmount" type="number" step="0.01" min="0" defaultValue="0" className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Reference</label>
          <input name="reference" className="w-full" />
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary text-sm">
        {loading ? "Saving..." : "Record Payment"}
      </button>
    </form>
  );
}