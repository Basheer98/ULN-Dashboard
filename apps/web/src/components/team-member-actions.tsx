"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { PASSWORD_MIN_LENGTH, PASSWORD_RULES_TEXT } from "@uln/shared";
import { PasswordInput } from "@/components/password-input";

export function TeamMemberActions({
  userId,
  name,
  isActive,
  isSelf,
  afterRemoveHref,
}: {
  userId: string;
  name: string;
  isActive: boolean;
  isSelf: boolean;
  afterRemoveHref?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/v1/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error || "Failed to reset password");
      return;
    }
    setResetting(false);
    setNewPassword("");
    toast.success(`Password updated for ${name}`);
  }

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
    if (afterRemoveHref && data.mode === "deleted") router.push(afterRemoveHref);
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

  if (resetting) {
    return (
      <form onSubmit={handleResetPassword} className="flex flex-wrap items-center justify-end gap-2">
        <div className="w-44">
          <PasswordInput
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={72}
            placeholder="New password"
            title={PASSWORD_RULES_TEXT}
            autoComplete="new-password"
            className="w-full text-xs"
          />
        </div>
        <button type="submit" className="btn-primary text-xs" disabled={loading}>
          {loading ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          className="btn-secondary text-xs"
          disabled={loading}
          onClick={() => {
            setResetting(false);
            setNewPassword("");
          }}
        >
          Cancel
        </button>
      </form>
    );
  }

  if (!confirming) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary text-xs" onClick={() => setResetting(true)}>
          Reset password
        </button>
        <button
          type="button"
          className="btn-secondary text-xs text-danger"
          onClick={() => setConfirming(true)}
        >
          Remove
        </button>
      </div>
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
