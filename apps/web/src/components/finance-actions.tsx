"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InvoiceActions({
  invoiceId,
  invoiceNumber,
  status,
}: {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  async function updateStatus(newStatus: string) {
    setLoading(true);
    setError("");
    await fetch(`/api/v1/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
    setLoading(false);
  }

  async function handleEmail() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/v1/invoices/${invoiceId}/email`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to email invoice");
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/v1/invoices/${invoiceId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to delete invoice");
      setLoading(false);
      return;
    }
    setConfirmingDelete(false);
    router.refresh();
  }

  if (confirmingDelete) {
    return (
      <div className="min-w-[200px] space-y-2 rounded-md border border-danger/40 bg-danger/5 p-2">
        <p className="text-xs text-foreground">
          Delete <span className="font-medium">{invoiceNumber}</span>? It will be hidden from
          lists. Payment history stays.
        </p>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            disabled={loading}
            onClick={handleDelete}
            className="btn-primary bg-danger hover:opacity-90 text-xs"
          >
            {loading ? "Deleting..." : "Yes, delete"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setConfirmingDelete(false);
              setError("");
            }}
            className="btn-secondary text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {status === "draft" && (
          <button type="button" disabled={loading} onClick={() => updateStatus("sent")} className="btn-primary text-xs">
            Mark Sent
          </button>
        )}
        {(status === "sent" || status === "partial" || status === "overdue") && (
          <button type="button" disabled={loading} onClick={() => updateStatus("paid")} className="btn-primary text-xs">
            Mark Paid
          </button>
        )}
        <button type="button" disabled={loading} onClick={handleEmail} className="btn-secondary text-xs">
          Email PDF
        </button>
        <a href={`/api/v1/invoices/${invoiceId}/pdf`} className="btn-secondary text-xs">
          Download PDF
        </a>
        <button
          type="button"
          disabled={loading}
          onClick={() => setConfirmingDelete(true)}
          className="btn-secondary text-danger text-xs"
        >
          Delete
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function GenerateInvoiceButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/v1/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed");
      setLoading(false);
      return;
    }
    router.push("/invoices");
    router.refresh();
  }

  return (
    <div>
      <button type="button" disabled={loading} onClick={generate} className="btn-primary text-sm">
        Generate Invoice
      </button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function GeneratePaymentsButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    await fetch("/api/v1/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    router.push("/payments");
    router.refresh();
  }

  return (
    <button type="button" disabled={loading} onClick={generate} className="btn-primary text-sm">
      Generate Fielder Payments
    </button>
  );
}
