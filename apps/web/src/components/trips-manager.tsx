"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { US_STATES } from "@uln/shared";
import { StatusBadge } from "@/components/layout";

interface Trip {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  state: string | null;
  city: string | null;
  purpose: string | null;
  budget: number | null;
  status: string;
  projectIds: string[];
}

interface ProjectOption {
  id: string;
  projectNumber: string;
  title: string;
}

export function TripsManager() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    state: "",
    city: "",
    purpose: "",
    budget: "",
    projectIds: [] as string[],
  });

  const load = useCallback(async () => {
    const [tripRes, projRes] = await Promise.all([
      fetch("/api/v1/finance/trips"),
      fetch("/api/v1/projects"),
    ]);
    if (tripRes.ok) setTrips(await tripRes.json());
    if (projRes.ok) {
      const data = await projRes.json();
      setProjects(
        data.map((p: ProjectOption & { title: string }) => ({
          id: p.id,
          projectNumber: p.projectNumber,
          title: p.title,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleProject(id: string) {
    setForm((f) => ({
      ...f,
      projectIds: f.projectIds.includes(id)
        ? f.projectIds.filter((x) => x !== id)
        : [...f.projectIds, id],
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/v1/finance/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        purpose: form.purpose || undefined,
        budget: form.budget ? Number(form.budget) : undefined,
        status: "planned",
        projectIds: form.projectIds,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Failed to create trip");
      return;
    }
    setShowForm(false);
    setForm({
      name: "",
      startDate: "",
      endDate: "",
      state: "",
      city: "",
      purpose: "",
      budget: "",
      projectIds: [],
    });
    load();
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading trips...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="page-toolbar">
        <p className="text-sm text-muted-foreground">
          Group multi-day travel, mileage, and expenses by trip.
        </p>
        <button type="button" onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
          {showForm ? "Cancel" : "New Trip"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <h2 className="font-semibold text-foreground">Create Trip</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Trip Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Denver metro week — March"
                className="w-full"
              />
            </div>
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full"
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full"
              />
            </div>
            <div>
              <label className="label">State</label>
              <select
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full"
              >
                <option value="">—</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">City</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full"
              />
            </div>
            <div>
              <label className="label">Budget</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Purpose</label>
              <input
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Link Projects</label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                {projects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No projects available</p>
                ) : (
                  projects.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.projectIds.includes(p.id)}
                        onChange={() => toggleProject(p.id)}
                      />
                      {p.projectNumber} — {p.title}
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Creating..." : "Create Trip"}
          </button>
        </form>
      )}

      {trips.length === 0 ? (
        <div className="card text-center text-sm text-muted-foreground">
          No trips yet. Create one to track multi-day field work.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Trip</th>
                <th>Dates</th>
                <th>Location</th>
                <th>Projects</th>
                <th>Budget</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id}>
                  <td>
                    <p className="font-medium">{t.name}</p>
                    {t.purpose && <p className="text-xs text-muted-foreground">{t.purpose}</p>}
                  </td>
                  <td className="whitespace-nowrap text-sm">
                    {t.startDate ? new Date(t.startDate).toLocaleDateString() : "—"}
                    {t.endDate ? ` → ${new Date(t.endDate).toLocaleDateString()}` : ""}
                  </td>
                  <td>{[t.city, t.state].filter(Boolean).join(", ") || "—"}</td>
                  <td>{t.projectIds?.length ?? 0}</td>
                  <td>{t.budget != null ? `$${t.budget.toFixed(2)}` : "—"}</td>
                  <td><StatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
