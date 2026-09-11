"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { US_STATES } from "@uln/shared";

interface ClientOption {
  id: string;
  name: string;
}

export interface ProjectEditValues {
  id: string;
  projectNumber: string;
  clientId: string;
  title: string;
  siteAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  jobType: string | null;
  qfield: number | null;
  description: string | null;
  sqft: number;
  buriedSqft: number | null;
  aerialSqft: number | null;
  clientSqftRate: number;
  status: string;
  dueDate: string | null;
  notes: string | null;
}

const STATUSES = [
  "draft",
  "assigned",
  "in_progress",
  "complete",
  "invoiced",
  "paid",
  "cancelled",
] as const;

export function ProjectEditForm({ project }: { project: ProjectEditValues }) {
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState(project.clientId);
  const [stateCode, setStateCode] = useState(project.state || "");
  const [clientSqftRate, setClientSqftRate] = useState(String(project.clientSqftRate));
  const [sqft, setSqft] = useState(String(project.sqft));
  const [buriedSqft, setBuriedSqft] = useState(
    project.buriedSqft != null ? String(project.buriedSqft) : ""
  );
  const [aerialSqft, setAerialSqft] = useState(
    project.aerialSqft != null ? String(project.aerialSqft) : ""
  );
  const [status, setStatus] = useState(project.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function applySplit(nextBuried: string, nextAerial: string) {
    setBuriedSqft(nextBuried);
    setAerialSqft(nextAerial);
    const b = Number(nextBuried);
    const a = Number(nextAerial);
    if (nextBuried !== "" && nextAerial !== "" && Number.isFinite(b) && Number.isFinite(a)) {
      setSqft(String(b + a));
    }
  }

  useEffect(() => {
    fetch("/api/v1/clients")
      .then((r) => r.json())
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    const form = new FormData(e.currentTarget);
    const payload = {
      projectNumber: form.get("projectNumber"),
      clientId,
      title: form.get("title"),
      siteAddress: form.get("siteAddress"),
      city: form.get("city") || undefined,
      state: stateCode || undefined,
      zip: form.get("zip") || undefined,
      jobType: form.get("jobType") || undefined,
      qfield: form.get("qfield") ? Number(form.get("qfield")) : null,
      description: form.get("description") || undefined,
      sqft,
      buriedSqft: buriedSqft === "" ? null : Number(buriedSqft),
      aerialSqft: aerialSqft === "" ? null : Number(aerialSqft),
      clientSqftRate,
      status,
      dueDate: form.get("dueDate") || null,
      notes: form.get("notes") || undefined,
    };

    const res = await fetch(`/api/v1/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to update project");
      setLoading(false);
      return;
    }

    setSaved(true);
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-foreground">Edit Project</h2>
        {saved && <p className="text-sm text-success">Saved</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Project Number *</label>
          <input
            name="projectNumber"
            required
            defaultValue={project.projectNumber}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Client *</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            className="w-full"
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Project Title *</label>
          <input name="title" required defaultValue={project.title} className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Site Address *</label>
          <input
            name="siteAddress"
            required
            defaultValue={project.siteAddress}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">City</label>
          <input name="city" defaultValue={project.city || ""} className="w-full" />
        </div>
        <div>
          <label className="label">State</label>
          <select
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            className="w-full"
          >
            <option value="">Select state</option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ZIP</label>
          <input name="zip" defaultValue={project.zip || ""} className="w-full" />
        </div>
        <div>
          <label className="label">Job Type</label>
          <input name="jobType" defaultValue={project.jobType || ""} className="w-full" />
        </div>
        <div>
          <label className="label">QField Login</label>
          <select name="qfield" className="w-full" defaultValue={project.qfield ?? ""}>
            <option value="">Not set</option>
            <option value="1">QField 1</option>
            <option value="2">QField 2</option>
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full capitalize"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Total SQFT *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={sqft}
            onChange={(e) => setSqft(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="label">Buried SQFT</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={buriedSqft}
            onChange={(e) => applySplit(e.target.value, aerialSqft)}
            className="w-full"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="label">Aerial SQFT</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={aerialSqft}
            onChange={(e) => applySplit(buriedSqft, e.target.value)}
            className="w-full"
            placeholder="Optional"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Filling both auto-sets total SQFT.
          </p>
        </div>
        <div>
          <label className="label">Client Rate ($/SQFT) *</label>
          <input
            value={clientSqftRate}
            onChange={(e) => setClientSqftRate(e.target.value)}
            type="number"
            step="0.0001"
            min="0"
            required
            className="w-full"
          />
        </div>
        <div>
          <label className="label">ECD</label>
          <input
            name="dueDate"
            type="date"
            defaultValue={project.dueDate || ""}
            className="w-full"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea
            name="description"
            rows={2}
            defaultValue={project.description || ""}
            className="w-full"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} defaultValue={project.notes || ""} className="w-full" />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={loading || !clientId} className="btn-primary">
        {loading ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
