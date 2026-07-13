"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout";

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      contactName: form.get("contactName") || undefined,
      email: form.get("email") || undefined,
      phone: form.get("phone") || undefined,
      defaultSqftRate: form.get("defaultSqftRate"),
      billingTerms: form.get("billingTerms") || undefined,
      notes: form.get("notes") || undefined,
    };

    const res = await fetch("/api/v1/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create client");
      setLoading(false);
      return;
    }

    router.push(`/clients/${data.id}`);
    router.refresh();
  }

  return (
    <>
      <Header title="Add Client" subtitle="Create a new client account" />
      <main className="page-main">
        <form onSubmit={handleSubmit} className="card mx-auto max-w-2xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Client Name *</label>
              <input name="name" required placeholder="Amdocs" className="w-full" />
            </div>
            <div>
              <label className="label">Contact Name</label>
              <input name="contactName" className="w-full" />
            </div>
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" className="w-full" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input name="phone" className="w-full" />
            </div>
            <div>
              <label className="label">Default Rate ($/SQFT) *</label>
              <input name="defaultSqftRate" type="number" step="0.0001" min="0" defaultValue="0.030" required className="w-full" />
              <p className="mt-1 text-xs text-muted-foreground">Standard client rate is $0.030 / SQFT.</p>
            </div>
            <div>
              <label className="label">Billing Terms</label>
              <input name="billingTerms" placeholder="Net 30" className="w-full" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea name="notes" rows={3} className="w-full" />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Saving..." : "Create Client"}
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
