"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InvoiceActions({ invoiceId, status }: { invoiceId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    await fetch(`/api/v1/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
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
      <a href={`/api/v1/invoices/${invoiceId}/pdf`} className="btn-secondary text-xs">
        Download PDF
      </a>
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
