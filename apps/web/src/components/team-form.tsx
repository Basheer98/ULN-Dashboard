"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TeamUserForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);

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

    e.currentTarget.reset();
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
      <input name="email" type="email" required placeholder="Email" className="w-full" />
      <input name="password" type="password" required minLength={6} placeholder="Password" className="w-full" />
      <select name="role" required className="w-full">
        <option value="dispatcher">Dispatcher</option>
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
