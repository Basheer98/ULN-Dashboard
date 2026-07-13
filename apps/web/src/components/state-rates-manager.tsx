"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DEFAULT_CLIENT_SQFT_RATE,
  DEFAULT_FIELDER_SQFT_RATE,
  US_STATES,
  formatRate,
} from "@uln/shared";

interface StateRateRow {
  id: string;
  state: string;
  clientSqftRate: number;
  fielderSqftRate: number;
  notes: string | null;
}

export function StateRatesManager({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [rates, setRates] = useState<StateRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [state, setState] = useState("");
  const [clientRate, setClientRate] = useState(String(DEFAULT_CLIENT_SQFT_RATE));
  const [fielderRate, setFielderRate] = useState(String(DEFAULT_FIELDER_SQFT_RATE));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/api/v1/state-rates")
      .then((r) => r.json())
      .then((data) => setRates(data))
      .finally(() => setLoading(false));
  }, []);

  async function saveRate(e: React.FormEvent) {
    e.preventDefault();
    if (!state) return;
    setError("");
    const res = await fetch("/api/v1/state-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state,
        clientSqftRate: Number(clientRate),
        fielderSqftRate: Number(fielderRate),
        notes: notes || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
      return;
    }
    setState("");
    setNotes("");
    router.refresh();
    const updated = await fetch("/api/v1/state-rates").then((r) => r.json());
    setRates(updated);
  }

  async function removeRate(stateCode: string) {
    if (!confirm(`Remove rate override for ${stateCode}?`)) return;
    await fetch(`/api/v1/state-rates/${stateCode}`, { method: "DELETE" });
    setRates((prev) => prev.filter((r) => r.state !== stateCode));
    router.refresh();
  }

  const configuredStates = new Set(rates.map((r) => r.state));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Company client rate</p>
          <p className="mt-2 text-2xl font-semibold">{formatRate(DEFAULT_CLIENT_SQFT_RATE)} / SQFT</p>
          <p className="mt-1 text-xs text-muted-foreground">Used when no client or state override applies.</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">Company fielder rate</p>
          <p className="mt-2 text-2xl font-semibold">{formatRate(DEFAULT_FIELDER_SQFT_RATE)} / SQFT</p>
          <p className="mt-1 text-xs text-muted-foreground">Used when no fielder or state override applies.</p>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold text-foreground">Rate priority</h2>
        <p className="text-sm text-muted-foreground">
          <strong>Client billing:</strong> manual on project → client default → state override → company default ($0.030).
          <br />
          <strong>Fielder pay:</strong> manual on assignment → fielder default → state override → company default ($0.015).
        </p>
      </div>

      {canEdit && (
        <form onSubmit={saveRate} className="card space-y-4">
          <h2 className="font-semibold text-foreground">Add / update state override</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">State</label>
              <select value={state} onChange={(e) => setState(e.target.value)} required className="w-full">
                <option value="">Select state</option>
                {US_STATES.filter((s) => !configuredStates.has(s.code) || rates.find((r) => r.state === s.code))
                  .map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label">Client rate ($/SQFT)</label>
              <input
                value={clientRate}
                onChange={(e) => setClientRate(e.target.value)}
                type="number"
                step="0.0001"
                min="0"
                required
                className="w-full"
              />
            </div>
            <div>
              <label className="label">Fielder rate ($/SQFT)</label>
              <input
                value={fielderRate}
                onChange={(e) => setFielderRate(e.target.value)}
                type="number"
                step="0.0001"
                min="0"
                required
                className="w-full"
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="w-full" />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" className="btn-primary">Save state rate</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <h2 className="mb-4 font-semibold text-foreground">State overrides</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : rates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No state overrides yet. All projects use company defaults unless the client has its own rate.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>State</th>
                <th>Client rate</th>
                <th>Fielder rate</th>
                <th>Margin/SQFT</th>
                <th>Notes</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id}>
                  <td>{US_STATES.find((s) => s.code === r.state)?.name ?? r.state}</td>
                  <td>{formatRate(Number(r.clientSqftRate))}</td>
                  <td>{formatRate(Number(r.fielderSqftRate))}</td>
                  <td>{formatRate(Number(r.clientSqftRate) - Number(r.fielderSqftRate))}</td>
                  <td className="text-muted-foreground">{r.notes || "—"}</td>
                  {canEdit && (
                    <td>
                      <button
                        type="button"
                        onClick={() => removeRate(r.state)}
                        className="text-xs text-danger hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
