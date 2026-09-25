"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/layout";

export type ProjectRow = {
  id: string;
  projectNumber: string;
  title: string;
  clientName: string;
  state: string;
  qfield: number | null;
  sqft: number;
  buriedSqft: number | null;
  aerialSqft: number | null;
  clientBill: number;
  dueDate: string | null;
  fielderName: string | null;
  status: string;
};

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function ProjectsTable({
  projects,
  canSeeMoney = true,
}: {
  projects: ProjectRow[];
  canSeeMoney?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportSelected() {
    const rows = projects.filter((p) => selected.has(p.id));
    if (rows.length === 0) return;
    const headers = canSeeMoney
      ? ["Project #", "Title", "Client", "State", "Status", "SQFT", "Client Bill", "ECD", "Fielder"]
      : ["Project #", "Title", "Client", "State", "Status", "SQFT", "ECD", "Fielder"];
    downloadCsv("projects.csv", [
      headers,
      ...rows.map((p) =>
        canSeeMoney
          ? [
              p.projectNumber,
              p.title,
              p.clientName,
              p.state,
              p.status,
              String(p.sqft),
              String(p.clientBill),
              p.dueDate ? new Date(p.dueDate).toLocaleDateString() : "",
              p.fielderName ?? "",
            ]
          : [
              p.projectNumber,
              p.title,
              p.clientName,
              p.state,
              p.status,
              String(p.sqft),
              p.dueDate ? new Date(p.dueDate).toLocaleDateString() : "",
              p.fielderName ?? "",
            ]
      ),
    ]);
  }

  if (projects.length === 0) {
    return (
      <div className="card text-center text-sm text-muted-foreground">
        No projects match these filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={selected.size === 0}
          onClick={exportSelected}
        >
          Export selected ({selected.size})
        </button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground md:hidden">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          Select all
        </label>
      </div>

      <div className="mobile-card-list">
        {projects.map((project) => (
          <div key={project.id} className="card space-y-3 p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.has(project.id)}
                onChange={() => toggle(project.id)}
                aria-label={`Select ${project.projectNumber}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/projects/${project.id}`} className="link text-base">
                    {project.projectNumber}
                  </Link>
                  <StatusBadge status={project.status} />
                </div>
                <p className="mt-1 text-sm text-foreground">{project.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{project.clientName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">State</p>
                <p>{project.state || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SQFT</p>
                <p>{project.sqft.toLocaleString()}</p>
              </div>
              {canSeeMoney ? (
                <div>
                  <p className="text-xs text-muted-foreground">Bill</p>
                  <p>{formatMoney(project.clientBill)}</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs text-muted-foreground">ECD</p>
                <p>{project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "—"}</p>
              </div>
            </div>
            {project.fielderName ? (
              <p className="text-xs text-muted-foreground">Fielder: {project.fielderName}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="desktop-table">
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all projects"
                  />
                </th>
                <th>Project</th>
                <th>Client</th>
                <th>State</th>
                <th>QField</th>
                <th>SQFT</th>
                {canSeeMoney ? <th>Client Bill</th> : null}
                <th>ECD</th>
                <th>Fielder</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(project.id)}
                      onChange={() => toggle(project.id)}
                      aria-label={`Select ${project.projectNumber}`}
                    />
                  </td>
                  <td>
                    <Link href={`/projects/${project.id}`} className="link">
                      {project.projectNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">{project.title}</p>
                  </td>
                  <td>{project.clientName}</td>
                  <td>{project.state}</td>
                  <td>{project.qfield ? `QField ${project.qfield}` : "—"}</td>
                  <td>
                    {project.sqft.toLocaleString()}
                    {(project.buriedSqft != null || project.aerialSqft != null) && (
                      <p className="text-xs text-muted-foreground">
                        {project.buriedSqft != null
                          ? `B ${project.buriedSqft.toLocaleString()}`
                          : null}
                        {project.buriedSqft != null && project.aerialSqft != null ? " · " : null}
                        {project.aerialSqft != null
                          ? `A ${project.aerialSqft.toLocaleString()}`
                          : null}
                      </p>
                    )}
                  </td>
                  {canSeeMoney ? <td>{formatMoney(project.clientBill)}</td> : null}
                  <td>{project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "—"}</td>
                  <td>{project.fielderName || "—"}</td>
                  <td>
                    <StatusBadge status={project.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
