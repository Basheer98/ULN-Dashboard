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

export function ProjectsTable({ projects }: { projects: ProjectRow[] }) {
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
    downloadCsv("projects.csv", [
      ["Project #", "Title", "Client", "State", "Status", "SQFT", "Client Bill", "ECD", "Fielder"],
      ...rows.map((p) => [
        p.projectNumber,
        p.title,
        p.clientName,
        p.state,
        p.status,
        String(p.sqft),
        String(p.clientBill),
        p.dueDate ? new Date(p.dueDate).toLocaleDateString() : "",
        p.fielderName ?? "",
      ]),
    ]);
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
      </div>
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
              <th>Client Bill</th>
              <th>ECD</th>
              <th>Fielder</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center text-sm text-muted-foreground">
                  No projects match these filters.
                </td>
              </tr>
            ) : (
              projects.map((project) => (
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
                  <td>{formatMoney(project.clientBill)}</td>
                  <td>{project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "—"}</td>
                  <td>{project.fielderName || "—"}</td>
                  <td>
                    <StatusBadge status={project.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
