"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OPERATING_COST_FREQUENCIES, formatCurrency } from "@uln/shared";
import type { RecurringCostRow } from "@/lib/operations-cost";
import { toast } from "@/lib/toast";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export function OperatingCostsManager({
  costs,
  categories,
  currentMonthlyFixed,
  canEdit,
}: {
  costs: RecurringCostRow[];
  categories: { id: string; name: string }[];
  currentMonthlyFixed: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<RecurringCostRow | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function resetForm() {
    setEditing(null);
    setFormKey((k) => k + 1);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(
      editing ? `/api/v1/finance/operating-costs/${editing.id}` : "/api/v1/finance/operating-costs",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          amount: Number(form.get("amount")),
          frequency: form.get("frequency"),
          categoryId: form.get("categoryId") || null,
          startDate: form.get("startDate") || null,
          endDate: form.get("endDate") || null,
          notes: form.get("notes") || null,
        }),
      }
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to save cost");
      return;
    }
    toast.success(editing ? "Cost updated" : "Cost added");
    resetForm();
    router.refresh();
  }

  async function toggleActive(cost: RecurringCostRow) {
    const res = await fetch(`/api/v1/finance/operating-costs/${cost.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !cost.isActive }),
    });
    if (res.ok) {
      toast.success(cost.isActive ? `${cost.name} paused` : `${cost.name} resumed`);
      router.refresh();
    } else {
      toast.error("Failed to update cost");
    }
  }

  async function remove(cost: RecurringCostRow) {
    if (!confirm(`Delete "${cost.name}"? Past reports will no longer include it.`)) return;
    const res = await fetch(`/api/v1/finance/operating-costs/${cost.id}`, { method: "DELETE" });
    if (res.ok) {
      if (editing?.id === cost.id) resetForm();
      toast.success(`${cost.name} deleted`);
      router.refresh();
    } else {
      toast.error("Failed to delete cost");
    }
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-semibold text-foreground">Recurring Operating Costs</h2>
          <p className="text-sm text-muted-foreground">
            Fixed costs you pay regardless of work volume: rent, insurance, software, salaries, vehicle
            payments. Link a cost to an expense category and any expenses recorded in that category
            replace the estimate for that month, so nothing is counted twice.
          </p>
        </div>
        <p className="text-sm">
          Current monthly total:{" "}
          <span className="font-semibold">{formatCurrency(currentMonthlyFixed)}</span>
        </p>
      </div>

      {canEdit && (
        <form key={formKey} onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium text-foreground">
            {editing ? `Edit "${editing.name}"` : "Add recurring cost"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">Name *</label>
              <input name="name" required defaultValue={editing?.name} placeholder="Office rent" className="w-full" />
            </div>
            <div>
              <label className="label">Amount *</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={editing?.amount}
                className="w-full"
              />
            </div>
            <div>
              <label className="label">Frequency</label>
              <select name="frequency" defaultValue={editing?.frequency ?? "monthly"} className="w-full">
                {OPERATING_COST_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Expense category (optional)</label>
              <select name="categoryId" defaultValue={editing?.categoryId ?? ""} className="w-full">
                <option value="">Not linked</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Start date</label>
              <input name="startDate" type="date" defaultValue={editing?.startDate ?? ""} className="w-full" />
            </div>
            <div>
              <label className="label">End date</label>
              <input name="endDate" type="date" defaultValue={editing?.endDate ?? ""} className="w-full" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label">Notes</label>
              <input name="notes" defaultValue={editing?.notes ?? ""} className="w-full" />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Saving..." : editing ? "Save changes" : "Add cost"}
            </button>
            {editing && (
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {costs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No recurring costs yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Amount</th>
                <th>Monthly</th>
                <th>Linked category</th>
                <th>Dates</th>
                <th>Status</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {costs.map((cost) => (
                <tr key={cost.id} className={cost.isActive ? undefined : "opacity-60"}>
                  <td>
                    <p className="font-medium">{cost.name}</p>
                    {cost.notes && <p className="text-xs text-muted-foreground">{cost.notes}</p>}
                  </td>
                  <td>
                    {formatCurrency(cost.amount)}{" "}
                    <span className="text-xs text-muted-foreground">
                      / {FREQUENCY_LABELS[cost.frequency]?.toLowerCase() ?? cost.frequency}
                    </span>
                  </td>
                  <td>{formatCurrency(cost.monthlyAmount)}</td>
                  <td>{cost.categoryName ?? "—"}</td>
                  <td className="whitespace-nowrap text-sm">
                    {cost.startDate || cost.endDate
                      ? `${cost.startDate ?? "…"} → ${cost.endDate ?? "ongoing"}`
                      : "Ongoing"}
                  </td>
                  <td>
                    <span className={`badge ${cost.isActive ? "badge-success" : "badge-neutral"}`}>
                      {cost.isActive ? "Active" : "Paused"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="whitespace-nowrap text-right">
                      <button
                        type="button"
                        className="btn-ghost text-sm"
                        onClick={() => {
                          setEditing(cost);
                          setFormKey((k) => k + 1);
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" className="btn-ghost text-sm" onClick={() => toggleActive(cost)}>
                        {cost.isActive ? "Pause" : "Resume"}
                      </button>
                      <button type="button" className="btn-ghost text-sm text-danger" onClick={() => remove(cost)}>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
