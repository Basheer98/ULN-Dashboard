"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/layout";
import { formatCurrency, formatRate } from "@uln/shared";

interface FielderOption {
  id: string;
  name: string;
  defaultSqftRate: number;
}

interface ProjectData {
  id: string;
  status: string;
  sqft?: number;
  assignments: Array<{
    id: string;
    fielderId: string;
    fielderSqftRate: number;
    assignedSqft?: number;
    status: string;
    fielder: { firstName: string; lastName: string };
  }>;
  lineItems: Array<{
    id: string;
    type: string;
    description: string;
    amount: number;
    fielderId: string | null;
  }>;
}

interface Financials {
  fielders: Array<{
    fielderId: string;
    fielderName: string;
    total: number;
  }>;
}

export function ProjectActions({
  project,
  projectState,
  fielders,
  financials,
}: {
  project: ProjectData;
  projectState?: string | null;
  fielders: FielderOption[];
  financials: Financials;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFielder, setSelectedFielder] = useState("");
  const [fielderRate, setFielderRate] = useState("");
  const [assignedSqft, setAssignedSqft] = useState("");

  async function assignFielder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFielder) return;
    setLoading(true);
    setError("");

    const fielder = fielders.find((f) => f.id === selectedFielder);
    const body: Record<string, unknown> = {
      fielderId: selectedFielder,
      fielderSqftRate: fielderRate || fielder?.defaultSqftRate || 0,
    };
    if (assignedSqft) body.assignedSqft = Number(assignedSqft);

    const res = await fetch(`/api/v1/projects/${project.id}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to assign fielder");
      setLoading(false);
      return;
    }

    router.refresh();
    setLoading(false);
    setSelectedFielder("");
    setFielderRate("");
    setAssignedSqft("");
  }

  async function updateStatus(status: string) {
    setLoading(true);
    await fetch(`/api/v1/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
    setLoading(false);
  }

  async function addLineItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);

    const res = await fetch(`/api/v1/projects/${project.id}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.get("type"),
        description: form.get("description"),
        amount: form.get("amount"),
        fielderId: form.get("fielderId") || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to add line item");
      setLoading(false);
      return;
    }

    e.currentTarget.reset();
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card">
        <h2 className="mb-4 font-semibold text-foreground">Assignments</h2>
        {project.assignments.length === 0 ? (
          <p className="mb-4 text-sm text-muted-foreground">No fielders assigned yet.</p>
        ) : (
          <ul className="mb-4 space-y-3">
            {project.assignments.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {a.fielder.firstName} {a.fielder.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRate(a.fielderSqftRate)}/SQFT
                    {a.assignedSqft ? ` · ${Number(a.assignedSqft).toLocaleString()} SQFT` : ""}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={assignFielder} className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-medium text-foreground">Assign Fielder</h3>
          <select
            value={selectedFielder}
            onChange={async (e) => {
              const id = e.target.value;
              setSelectedFielder(id);
              if (!id) return;
              const params = new URLSearchParams();
              if (projectState) params.set("state", projectState);
              params.set("fielderId", id);
              try {
                const data = await fetch(`/api/v1/rates/resolve?${params}`).then((r) => r.json());
                if (data.fielder) {
                  setFielderRate(String(data.fielder.fielderSqftRate));
                } else {
                  const f = fielders.find((x) => x.id === id);
                  if (f) setFielderRate(String(f.defaultSqftRate));
                }
              } catch {
                const f = fielders.find((x) => x.id === id);
                if (f) setFielderRate(String(f.defaultSqftRate));
              }
            }}
            className="w-full"
          >
            <option value="">Select fielder</option>
            {fielders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <input
            value={fielderRate}
            onChange={(e) => setFielderRate(e.target.value)}
            type="number"
            step="0.0001"
            min="0"
            placeholder="Fielder rate ($/SQFT)"
            className="w-full"
          />
          <input
            value={assignedSqft}
            onChange={(e) => setAssignedSqft(e.target.value)}
            type="number"
            step="1"
            min="0"
            placeholder={`Assigned SQFT${project.assignments.length === 0 ? " (defaults to full project)" : " (required for split)"}`}
            className="w-full"
          />
          <button type="submit" disabled={loading || !selectedFielder} className="btn-primary w-full">
            Assign to Project
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold text-foreground">Additional Billing</h2>
        {project.lineItems.length === 0 ? (
          <p className="mb-4 text-sm text-muted-foreground">No additional line items.</p>
        ) : (
          <ul className="mb-4 space-y-2 text-sm">
            {project.lineItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-lg bg-surface-elevated px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  {item.description}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({item.type.replace(/_/g, " ")})
                  </span>
                </span>
                <span>{formatCurrency(item.amount)}</span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addLineItem} className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-medium text-foreground">Add Line Item</h3>
          <select name="type" required className="w-full">
            <option value="client_billing">Client billing (extra charge)</option>
            <option value="fielder_payout">Fielder payout (extra pay)</option>
          </select>
          <input name="description" required placeholder="Description" className="w-full" />
          <input name="amount" type="number" step="0.01" required placeholder="Amount" className="w-full" />
          <select name="fielderId" className="w-full">
            <option value="">Fielder (optional, for payout)</option>
            {fielders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            Add Line Item
          </button>
        </form>
      </div>

      <div className="card lg:col-span-2">
        <h2 className="mb-4 font-semibold text-foreground">Project Status</h2>
        <div className="flex flex-wrap gap-2">
          {["draft", "assigned", "in_progress", "complete", "invoiced", "paid", "cancelled"].map((status) => (
            <button
              key={status}
              type="button"
              disabled={loading || project.status === status}
              onClick={() => updateStatus(status)}
              className={`btn-secondary text-xs capitalize ${
                project.status === status ? "border-accent/50 bg-accent/10 text-accent" : ""
              }`}
            >
              {status.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
