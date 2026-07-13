"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout";

export default function NewFielderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const payload = {
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      phone: form.get("phone") || undefined,
      email: form.get("email") || undefined,
      employmentType: form.get("employmentType"),
      defaultSqftRate: form.get("defaultSqftRate"),
      region: form.get("region") || undefined,
      loginEmail: form.get("loginEmail") || undefined,
      loginPassword: form.get("loginPassword") || undefined,
    };

    const res = await fetch("/api/v1/fielders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create fielder");
      setLoading(false);
      return;
    }

    router.push(`/fielders/${data.id}`);
    router.refresh();
  }

  return (
    <>
      <Header title="Add Fielder" subtitle="Create a fielder profile and optional mobile login" />
      <main className="page-main">
        <form onSubmit={handleSubmit} className="card mx-auto max-w-2xl space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">First Name *</label>
              <input name="firstName" required className="w-full" />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input name="lastName" required className="w-full" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input name="phone" className="w-full" />
            </div>
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" className="w-full" />
            </div>
            <div>
              <label className="label">Employment Type *</label>
              <select name="employmentType" required className="w-full">
                <option value="contractor_1099">1099 Contractor</option>
                <option value="w2">W-2 Employee</option>
              </select>
            </div>
            <div>
              <label className="label">Default Rate ($/SQFT) *</label>
              <input name="defaultSqftRate" type="number" step="0.0001" min="0" defaultValue="0.015" required className="w-full" />
              <p className="mt-1 text-xs text-muted-foreground">Standard fielder rate is $0.015 / SQFT.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Region</label>
              <input name="region" placeholder="Northeast" className="w-full" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-elevated p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Mobile App Login (optional)</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Login Email</label>
                <input name="loginEmail" type="email" className="w-full" />
              </div>
              <div>
                <label className="label">Login Password</label>
                <input name="loginPassword" type="password" minLength={6} className="w-full" />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Saving..." : "Create Fielder"}
            </button>
            <button type="button" onClick={() => router.back()} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
