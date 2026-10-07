"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";

const ROLE_OPTIONS = [
  { value: "dispatcher", label: "Dispatcher" },
  { value: "coordinator", label: "Project Coordinator (project entry only, no finance)" },
  { value: "accountant", label: "Accountant" },
  { value: "admin", label: "Admin" },
];

export function TeamMemberEditForm({
  userId,
  firstName,
  lastName,
  role,
  isSelf,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  role: string;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/v1/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: String(form.get("firstName") ?? "").trim(),
        lastName: String(form.get("lastName") ?? "").trim(),
        ...(isSelf ? {} : { role: form.get("role") }),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to save changes");
      return;
    }
    toast.success("Profile updated");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h2 className="font-semibold text-foreground">Edit details</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">First name</label>
          <input name="firstName" defaultValue={firstName} className="w-full" />
        </div>
        <div>
          <label className="label">Last name</label>
          <input name="lastName" defaultValue={lastName} className="w-full" />
        </div>
      </div>
      <div>
        <label className="label">Role</label>
        <select name="role" defaultValue={role} disabled={isSelf} className="w-full">
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {isSelf && (
          <p className="mt-1 text-xs text-muted-foreground">You can&apos;t change your own role.</p>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary text-sm">
        {loading ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}

export type SessionRow = {
  id: string;
  device: string;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function TeamMemberSessions({
  userId,
  sessions,
  canManage,
}: {
  userId: string;
  sessions: SessionRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const others = sessions.filter((s) => !s.isCurrent);

  async function revoke(sessionId?: string) {
    setBusy(sessionId ?? "all");
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    const res = await fetch(`/api/v1/users/${userId}/sessions${query}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error || "Failed to sign out");
      return;
    }
    toast.success(sessionId ? "Signed out of that device" : "Signed out of all devices");
    router.refresh();
  }

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-foreground">Active sessions</h2>
          <p className="text-sm text-muted-foreground">Devices currently signed in to this account.</p>
        </div>
        {canManage && others.length > 0 && (
          <button
            type="button"
            className="btn-secondary text-xs text-danger"
            disabled={busy !== null}
            onClick={() => revoke()}
          >
            {busy === "all" ? "Signing out..." : "Sign out everywhere"}
          </button>
        )}
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not signed in on any device.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-foreground">
                  {s.device}
                  {s.isCurrent && <span className="ml-2 text-xs text-success">This device</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  Signed in {formatWhen(s.createdAt)}
                  {s.ipAddress ? ` · IP ${s.ipAddress}` : ""} · expires {formatWhen(s.expiresAt)}
                </p>
              </div>
              {canManage && !s.isCurrent && (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={busy !== null}
                  onClick={() => revoke(s.id)}
                >
                  {busy === s.id ? "Signing out..." : "Sign out"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
