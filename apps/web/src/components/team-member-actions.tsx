"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";

export function TeamMemberActions({
  userId,
  name,
  isActive,
  isSelf,
}: {
  userId: string;
  name: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    setLoading(true);
    const res = await fetch(`/api/v1/users/${userId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error || "Failed to remove team member");
      return;
    }
    setConfirming(false);
    toast.success(`${name} removed`);
    router.refresh();
  }

  async function handleRestore() {
    setLoading(true);
    const res = await fetch(`/api/v1/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error || "Failed to restore team member");
      return;
    }
    toast.success(`${name} restored`);
    router.refresh();
  }

  if (isSelf) return <span className="text-xs text-muted-foreground">You</span>;

  if (!isActive) {
    return (
      <button type="button" className="btn-secondary text-xs" disabled={loading} onClick={handleRestore}>
        {loading ? "Restoring..." : "Restore"}
      </button>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="btn-secondary text-xs text-danger"
        onClick={() => setConfirming(true)}
      >
        Remove
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-foreground">Remove {name}?</span>
      <button
        type="button"
        className="btn-primary bg-danger text-xs hover:opacity-90"
        disabled={loading}
        onClick={handleRemove}
      >
        {loading ? "Removing..." : "Yes, remove"}
      </button>
      <button
        type="button"
        className="btn-secondary text-xs"
        disabled={loading}
        onClick={() => setConfirming(false)}
      >
        Cancel
      </button>
    </div>
  );
}
