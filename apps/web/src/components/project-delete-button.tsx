"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProjectDeleteButton({
  projectId,
  projectNumber,
}: {
  projectId: string;
  projectNumber: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/v1/projects/${projectId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to delete project");
      setLoading(false);
      return;
    }
    router.push("/projects");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button type="button" className="btn-secondary text-danger" onClick={() => setConfirming(true)}>
        Delete Project
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-danger/40 bg-danger/5 p-4 space-y-3">
      <p className="text-sm text-foreground">
        Delete <span className="font-medium">{projectNumber}</span>? This hides the project and
        removes linked expenses from active finance lists. Invoices and payments stay for history.
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
