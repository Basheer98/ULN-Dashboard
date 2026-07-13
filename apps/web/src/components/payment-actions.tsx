"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PaymentActions({ paymentId, status }: { paymentId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    await fetch(`/api/v1/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" && (
        <button type="button" disabled={loading} onClick={() => updateStatus("approved")} className="btn-secondary text-xs">
          Approve
        </button>
      )}
      {(status === "pending" || status === "approved") && (
        <button type="button" disabled={loading} onClick={() => updateStatus("paid")} className="btn-primary text-xs">
          Mark Paid
        </button>
      )}
    </div>
  );
}
