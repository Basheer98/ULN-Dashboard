"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { PASSWORD_MIN_LENGTH, PASSWORD_RULES_TEXT } from "@uln/shared";
import { PasswordInput } from "@/components/password-input";

export function TeamUserForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    const res = await fetch("/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        role: form.get("role"),
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create user");
      setLoading(false);
      return;
    }

    const created = await res.json().catch(() => ({}));
    formEl.reset();
    toast.success(created.email ? `Team member added — they sign in with ${created.email}` : "Team member added");
    router.refresh();
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h2 className="font-semibold text-foreground">Add Team Member</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="firstName" placeholder="First name" className="w-full" />
        <input name="lastName" placeholder="Last name" className="w-full" />
      </div>
      <input
        name="email"
        type="email"
        required
        placeholder="Email"
        className="w-full"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
      />
      <div>
        <PasswordInput name="password" required minLength={PASSWORD_MIN_LENGTH} maxLength={72} placeholder="Password" className="w-full" autoComplete="new-password" />
        <p className="mt-1 text-xs text-muted-foreground">{PASSWORD_RULES_TEXT}</p>
      </div>
      <select name="role" required className="w-full">
        <option value="dispatcher">Dispatcher</option>
        <option value="coordinator">Project Coordinator (project entry only, no finance)</option>
        <option value="accountant">Accountant</option>
        <option value="admin">Admin</option>
      </select>
      <button type="submit" disabled={loading} className="btn-primary">
        Create Account
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
