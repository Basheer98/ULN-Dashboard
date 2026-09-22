"use client";

import { useEffect, useState } from "react";

interface TitleRow {
  id: string;
  name: string;
  isActive: boolean;
}

export function ProjectTitlesManager({ canEdit }: { canEdit: boolean }) {
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/v1/project-titles?inactive=1");
    const data = await res.json();
    setTitles(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addTitle(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/v1/project-titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Failed to add title");
      return;
    }
    setName("");
    await load();
  }

  async function deactivate(id: string) {
    if (!confirm("Remove this title from the catalog?")) return;
    await fetch(`/api/v1/project-titles/${id}`, { method: "DELETE" });
    await load();
  }

  async function restore(id: string) {
    await fetch(`/api/v1/project-titles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    await load();
  }

  const active = titles.filter((t) => t.isActive);
  const inactive = titles.filter((t) => !t.isActive);

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-semibold text-foreground">Project titles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Managed catalog for create/edit dropdowns and the projects title filter (e.g. Lumen).
        </p>
      </div>

      {canEdit && (
        <form onSubmit={addTitle} className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lumen"
            className="min-w-[180px] flex-1"
          />
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Adding..." : "Add title"}
          </button>
        </form>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : active.length === 0 && inactive.length === 0 ? (
        <p className="text-sm text-muted-foreground">No titles yet. Add one above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {active.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className="text-sm text-muted-foreground">Active</td>
                  {canEdit && (
                    <td>
                      <button
                        type="button"
                        className="btn-secondary text-danger text-xs"
                        onClick={() => deactivate(t.id)}
                      >
                        Deactivate
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {inactive.map((t) => (
                <tr key={t.id}>
                  <td className="text-muted-foreground">{t.name}</td>
                  <td className="text-sm text-muted-foreground">Inactive</td>
                  {canEdit && (
                    <td>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => restore(t.id)}
                      >
                        Restore
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
