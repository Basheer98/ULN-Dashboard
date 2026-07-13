"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Vehicle {
  id: string;
  name: string;
  licensePlate: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  isActive: boolean;
}

export function VehiclesManager() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    licensePlate: "",
    make: "",
    model: "",
    year: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/finance/vehicles?includeInactive=true");
    if (res.ok) setVehicles(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/v1/finance/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        licensePlate: form.licensePlate || undefined,
        make: form.make || undefined,
        model: form.model || undefined,
        year: form.year ? Number(form.year) : undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Failed to add vehicle");
      return;
    }
    setForm({ name: "", licensePlate: "", make: "", model: "", year: "" });
    load();
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading vehicles...</p>;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="card space-y-4">
        <h2 className="font-semibold text-foreground">Add Vehicle</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Truck 1"
              className="w-full"
            />
          </div>
          <div>
            <label className="label">License Plate</label>
            <input
              value={form.licensePlate}
              onChange={(e) => setForm({ ...form, licensePlate: e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="label">Make</label>
            <input
              value={form.make}
              onChange={(e) => setForm({ ...form, make: e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="label">Model</label>
            <input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="label">Year</label>
            <input
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              className="w-full"
            />
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary text-sm">
          {saving ? "Adding..." : "Add Vehicle"}
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Plate</th>
              <th>Vehicle</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-muted-foreground">
                  No vehicles yet.
                </td>
              </tr>
            ) : (
              vehicles.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td>{v.licensePlate || "—"}</td>
                  <td>
                    {[v.year, v.make, v.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td>{v.isActive ? "Active" : "Inactive"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
