"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout";
import { DEFAULT_CLIENT_SQFT_RATE, US_STATES } from "@uln/shared";

interface ClientOption {
  id: string;
  name: string;
  defaultSqftRate: number;
}

interface FielderOption {
  id: string;
  firstName: string;
  lastName: string;
  defaultSqftRate: number;
  isActive: boolean;
}

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("clientId");

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [fielders, setFielders] = useState<FielderOption[]>([]);
  const [clientId, setClientId] = useState(preselectedClientId || "");
  const [stateCode, setStateCode] = useState("");
  const [clientSqftRate, setClientSqftRate] = useState(String(DEFAULT_CLIENT_SQFT_RATE));
  const [rateSource, setRateSource] = useState("Company default");
  const [fielderId, setFielderId] = useState("");
  const [fielderSqftRate, setFielderSqftRate] = useState("");
  const [assignedSqft, setAssignedSqft] = useState("");
  const [fielderRateSource, setFielderRateSource] = useState("");
  const [sqft, setSqft] = useState("");
  const [buriedSqft, setBuriedSqft] = useState("");
  const [aerialSqft, setAerialSqft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    Promise.all([
      fetch("/api/v1/clients").then((r) => r.json()),
      fetch("/api/v1/fielders").then((r) => r.json()),
    ]).then(([clientData, fielderData]) => {
      setClients(clientData);
      setFielders(
        (fielderData as FielderOption[]).filter((f) => f.isActive !== false)
      );
    });
  }, []);

  useEffect(() => {
    if (!clientId && !stateCode) return;
    const params = new URLSearchParams();
    if (clientId) params.set("clientId", clientId);
    if (stateCode) params.set("state", stateCode);

    fetch(`/api/v1/rates/resolve?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.client) {
          setClientSqftRate(String(data.client.clientSqftRate));
          setRateSource(data.client.label);
        }
      })
      .catch(() => {});
  }, [clientId, stateCode]);

  useEffect(() => {
    if (!fielderId) {
      setFielderSqftRate("");
      setFielderRateSource("");
      return;
    }

    const params = new URLSearchParams();
    if (stateCode) params.set("state", stateCode);
    params.set("fielderId", fielderId);

    fetch(`/api/v1/rates/resolve?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.fielder) {
          setFielderSqftRate(String(data.fielder.fielderSqftRate));
          setFielderRateSource(data.fielder.label);
        } else {
          const f = fielders.find((x) => x.id === fielderId);
          if (f) {
            setFielderSqftRate(String(f.defaultSqftRate));
            setFielderRateSource("Fielder default rate");
          }
        }
      })
      .catch(() => {
        const f = fielders.find((x) => x.id === fielderId);
        if (f) {
          setFielderSqftRate(String(f.defaultSqftRate));
          setFielderRateSource("Fielder default rate");
        }
      });
  }, [fielderId, stateCode, fielders]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const sqftValue = form.get("sqft");
    const payload: Record<string, unknown> = {
      projectNumber: form.get("projectNumber"),
      clientId,
      title: form.get("title"),
      siteAddress: form.get("siteAddress"),
      city: form.get("city") || undefined,
      state: stateCode || undefined,
      zip: form.get("zip") || undefined,
      jobType: form.get("jobType") || undefined,
      qfield: form.get("qfield") ? Number(form.get("qfield")) : undefined,
      description: form.get("description") || undefined,
      sqft: sqftValue,
      buriedSqft: buriedSqft === "" ? null : Number(buriedSqft),
      aerialSqft: aerialSqft === "" ? null : Number(aerialSqft),
      clientSqftRate: clientSqftRate,
      dueDate: form.get("dueDate") || undefined,
      notes: form.get("notes") || undefined,
    };

    if (fielderId) {
      payload.assignment = {
        fielderId,
        fielderSqftRate: fielderSqftRate || 0,
        ...(assignedSqft ? { assignedSqft: Number(assignedSqft) } : {}),
      };
    }

    const res = await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to create project");
      setLoading(false);
      return;
    }

    router.push(`/projects/${data.id}`);
    router.refresh();
  }

  return (
    <>
      <Header title="New Project" subtitle="Create a project with SQFT billing" />
      <main className="page-main">
        <form onSubmit={handleSubmit} className="card mx-auto max-w-3xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Project Number *</label>
              <input name="projectNumber" required placeholder="PRJ 3455" className="w-full" />
              <p className="mt-1 text-xs text-muted-foreground">Enter the client&apos;s project number.</p>
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
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Need a new client? <a href="/clients/new" className="link">Add client</a>
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Project Title *</label>
              <input name="title" required className="w-full" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Site Address *</label>
              <input name="siteAddress" required className="w-full" />
            </div>
            <div>
              <label className="label">City</label>
              <input name="city" className="w-full" />
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
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">ZIP</label>
              <input name="zip" className="w-full" />
            </div>
            <div>
              <label className="label">Job Type</label>
              <input name="jobType" placeholder="Fiber, MDU, Splice..." className="w-full" />
            </div>
            <div>
              <label className="label">QField Login</label>
              <select name="qfield" className="w-full" defaultValue="">
                <option value="">Not set</option>
                <option value="1">QField 1</option>
                <option value="2">QField 2</option>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">Which QField login the project file is uploaded to.</p>
            </div>
            <div>
              <label className="label">Total SQFT *</label>
              <input
                name="sqft"
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full"
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Billing uses total SQFT. Optional split below for buried/aerial jobs.
              </p>
            </div>
            <div>
              <label className="label">Buried SQFT</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full"
                value={buriedSqft}
                onChange={(e) => applySplit(e.target.value, aerialSqft)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="label">Aerial SQFT</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full"
                value={aerialSqft}
                onChange={(e) => applySplit(buriedSqft, e.target.value)}
                placeholder="Optional"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Filling both auto-sets total (e.g. 15,000 + 5,000 = 20,000).
              </p>
            </div>
            <div>
              <label className="label">Client Rate ($/SQFT) *</label>
              <input
                value={clientSqftRate}
                onChange={(e) => {
                  setClientSqftRate(e.target.value);
                  setRateSource("Manual override");
                }}
                type="number"
                step="0.0001"
                min="0"
                required
                className="w-full"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Auto-filled from {rateSource}. You can override manually.
              </p>
            </div>
            <div>
              <label className="label">ECD (Estimated Completion Date)</label>
              <input name="dueDate" type="date" className="w-full" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea name="description" rows={2} className="w-full" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea name="notes" rows={2} className="w-full" />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h2 className="text-sm font-semibold text-foreground">Assign Fielder</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Optional — assign now and the fielder gets a push notification on their phone.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Fielder</label>
                <select
                  value={fielderId}
                  onChange={(e) => setFielderId(e.target.value)}
                  className="w-full"
                >
                  <option value="">No assignment yet</option>
                  {fielders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.firstName} {f.lastName}
                    </option>
                  ))}
                </select>
              </div>
              {fielderId && (
                <>
                  <div>
                    <label className="label">Fielder Rate ($/SQFT) *</label>
                    <input
                      value={fielderSqftRate}
                      onChange={(e) => {
                        setFielderSqftRate(e.target.value);
                        setFielderRateSource("Manual override");
                      }}
                      type="number"
                      step="0.0001"
                      min="0"
                      required
                      className="w-full"
                    />
                    {fielderRateSource && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Auto-filled from {fielderRateSource}.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label">Assigned SQFT</label>
                    <input
                      value={assignedSqft}
                      onChange={(e) => setAssignedSqft(e.target.value)}
                      type="number"
                      step="1"
                      min="0"
                      placeholder={sqft ? `Defaults to ${sqft} SQFT` : "Defaults to full project SQFT"}
                      className="w-full"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Leave blank to assign the full project SQFT to this fielder.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading || !clientId || (Boolean(fielderId) && !fielderSqftRate)}
              className="btn-primary"
            >
              {loading
                ? "Creating..."
                : fielderId
                  ? "Create & Assign Fielder"
                  : "Create Project"}
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
