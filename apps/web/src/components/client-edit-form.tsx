"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatRate } from "@uln/shared";

interface ClientData {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  defaultSqftRate: number;
  billingTerms: string | null;
  notes: string | null;
  isActive: boolean;
}

export function ClientEditForm({ client }: { client: ClientData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: client.name,
    contactName: client.contactName ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    defaultSqftRate: String(client.defaultSqftRate),
    billingTerms: client.billingTerms ?? "",
    notes: client.notes ?? "",
    isActive: client.isActive,
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(`/api/v1/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        defaultSqftRate: Number(form.defaultSqftRate),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Update failed");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary text-sm">
        Edit Client
      </button>
    );
  }

  return (
    <form onSubmit={handleSave} className="card space-y-4">
      <h2 className="font-semibold text-foreground">Edit Client</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Name *</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Contact Name</label>
          <input
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Default Rate ($/SQFT)</label>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={form.defaultSqftRate}
            onChange={(e) => setForm({ ...form, defaultSqftRate: e.target.value })}
            className="w-full"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Current: {formatRate(client.defaultSqftRate)}/SQFT
          </p>
        </div>
        <div>
          <label className="label">Billing Terms</label>
          <input
            value={form.billingTerms}
            onChange={(e) => setForm({ ...form, billingTerms: e.target.value })}
            className="w-full"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active client
          </label>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Save Changes"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
