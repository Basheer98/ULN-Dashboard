"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProjectRestoreButton({
  projectId,
  projectNumber,
}: {
  projectId: string;
  projectNumber: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRestore() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/v1/projects/${projectId}/restore`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Restore failed");
      setLoading(false);
      return;
    }
    router.push(`/projects/${projectId}`);
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        className="btn-primary text-xs"
        disabled={loading}
        onClick={handleRestore}
        title={`Restore ${projectNumber}`}
      >
        {loading ? "Restoring…" : "Restore"}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
