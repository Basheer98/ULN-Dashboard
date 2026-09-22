"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FielderDeleteButton({
  fielderId,
  fielderName,
  isActive,
}: {
  fielderId: string;
  fielderName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/v1/fielders/${fielderId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to delete fielder");
      setLoading(false);
      return;
    }
    router.push("/fielders");
    router.refresh();
  }

  async function handleRestore() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/v1/fielders/${fielderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to restore fielder");
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
          {loading ? "Restoring..." : "Restore Fielder"}
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
        Delete Fielder
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-danger/40 bg-danger/5 p-4 space-y-3">
      <p className="text-sm text-foreground">
        Delete <span className="font-medium">{fielderName}</span>? They will be hidden from
        assignment pickers. Existing jobs and payments stay for history.
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
