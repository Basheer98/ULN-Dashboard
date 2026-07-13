"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatRate } from "@uln/shared";

interface FielderData {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  employmentType: string;
  defaultSqftRate: number;
  region: string | null;
  isActive: boolean;
}

export function FielderEditForm({ fielder }: { fielder: FielderData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: fielder.firstName,
    lastName: fielder.lastName,
    phone: fielder.phone ?? "",
    email: fielder.email ?? "",
    employmentType: fielder.employmentType,
    defaultSqftRate: String(fielder.defaultSqftRate),
    region: fielder.region ?? "",
    isActive: fielder.isActive,
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch(`/api/v1/fielders/${fielder.id}`, {
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
        Edit Fielder
      </button>
    );
  }

  return (
    <form onSubmit={handleSave} className="card space-y-4">
      <h2 className="font-semibold text-foreground">Edit Fielder</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">First Name *</label>
          <input
            required
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Last Name *</label>
          <input
            required
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
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
          <label className="label">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Employment Type</label>
          <select
            value={form.employmentType}
            onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
            className="w-full"
          >
            <option value="contractor_1099">1099 Contractor</option>
            <option value="w2">W-2 Employee</option>
          </select>
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
            Current: {formatRate(fielder.defaultSqftRate)}/SQFT
          </p>
        </div>
        <div>
          <label className="label">Region</label>
          <input
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
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
            Active fielder
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
