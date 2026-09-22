"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClientDeleteButton({
  clientId,
  clientName,
  isActive,
}: {
  clientId: string;
  clientName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/v1/clients/${clientId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to delete client");
      setLoading(false);
      return;
    }
    router.push("/clients");
    router.refresh();
  }

  async function handleRestore() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/v1/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to restore client");
      return;
    }
    router.refresh();
  }

  if (!isActive) {
    return (
      <div className="space-y-2">
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={loading}
          onClick={handleRestore}
        >
          {loading ? "Restoring..." : "Restore Client"}
        </button>
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="btn-secondary text-danger text-sm"
        onClick={() => setConfirming(true)}
      >
        Delete Client
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-danger/40 bg-danger/5 p-4 space-y-3">
      <p className="text-sm text-foreground">
        Delete <span className="font-medium">{clientName}</span>? They will be hidden from
        new-project pickers. Existing projects and invoices stay for history.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary bg-danger hover:opacity-90"
          disabled={loading}
          onClick={handleDelete}
        >
          {loading ? "Deleting..." : "Yes, delete"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={loading}
          onClick={() => {
            setConfirming(false);
            setError("");
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
