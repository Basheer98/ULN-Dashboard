"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCurrency } from "@uln/shared";

type PayEvent = {
  id: string;
  amount: number;
  paidAt: string;
  referenceNumber: string | null;
  notes: string | null;
  createdBy: string | null;
};

export function PaymentActions({
  paymentId,
  status,
  totalAmount,
  amountPaid = 0,
}: {
  paymentId: string;
  status: string;
  totalAmount: number;
  amountPaid?: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [events, setEvents] = useState<PayEvent[] | null>(null);
  const remaining = Math.max(0, Math.round((totalAmount - amountPaid) * 100) / 100);
  const [amount, setAmount] = useState(String(remaining || totalAmount));
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (!showHistory) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/v1/payments/${paymentId}`);
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (res.ok) setEvents(data.events ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [showHistory, paymentId]);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/v1/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Update failed");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  async function confirmPaid(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const payAmount = Number(amount);
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      setError("Enter a valid amount");
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/v1/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "paid",
        payAmount,
        referenceNumber: reference.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to record payment");
      setLoading(false);
      return;
    }
    setPaying(false);
    setEvents(null);
    setShowHistory(false);
    router.refresh();
    setLoading(false);
  }

  if (paying) {
    return (
      <form onSubmit={confirmPaid} className="min-w-[12rem] space-y-2">
        <div>
          <label className="label text-xs">Amount to pay *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full text-sm"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Owed {formatCurrency(totalAmount)} · paid {formatCurrency(amountPaid)} · remaining{" "}
            {formatCurrency(remaining)}
          </p>
        </div>
        <div>
          <label className="label text-xs">Reference (optional)</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Check #, Venmo, advance, etc."
            className="w-full text-sm"
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={loading} className="btn-primary text-xs">
            {loading ? "Saving..." : "Record payment"}
          </button>
          <button
            type="button"
            disabled={loading}
            className="btn-secondary text-xs"
            onClick={() => {
              setPaying(false);
              setError("");
              setAmount(String(remaining || totalAmount));
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {status === "pending" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => updateStatus("approved")}
            className="btn-secondary text-xs"
          >
            Approve
          </button>
        )}
        {(status === "pending" || status === "approved" || status === "partial") &&
          remaining > 0 && (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setAmount(String(remaining));
                setPaying(true);
              }}
              className="btn-primary text-xs"
            >
              {amountPaid > 0 ? "Pay more" : "Record payment"}
            </button>
          )}
        {amountPaid > 0 && (
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? "Hide history" : "History"}
          </button>
        )}
        {status === "paid" && remaining <= 0 && !amountPaid ? (
          <span className="text-xs text-muted-foreground">Paid in full</span>
        ) : null}
        {status === "paid" && remaining <= 0 && amountPaid > 0 && !showHistory ? (
          <span className="text-xs text-muted-foreground">Paid in full</span>
        ) : null}
      </div>
      {showHistory && (
        <div className="mt-1 max-w-xs rounded border border-border bg-muted/30 p-2 text-[11px]">
          {events == null ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-muted-foreground">No installments recorded.</p>
          ) : (
            <ul className="space-y-1">
              {events.map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{formatCurrency(e.amount)}</span>
                  {" · "}
                  {new Date(e.paidAt).toLocaleDateString()}
                  {e.referenceNumber ? ` · ${e.referenceNumber}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
