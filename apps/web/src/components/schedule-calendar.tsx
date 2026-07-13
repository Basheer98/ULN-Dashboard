"use client";

import Link from "next/link";

interface ScheduleProject {
  id: string;
  projectNumber: string;
  title: string;
  dueDate: string | null;
  status: string;
  client: { name: string };
  assignments: Array<{
    fielder: { firstName: string; lastName: string };
    status: string;
  }>;
}

export function ScheduleCalendar({ projects }: { projects: ScheduleProject[] }) {
  const byDate = new Map<string, ScheduleProject[]>();

  for (const p of projects) {
    if (!p.dueDate) continue;
    const key = p.dueDate.slice(0, 10);
    const list = byDate.get(key) ?? [];
    list.push(p);
    byDate.set(key, list);
  }

  const dates = Array.from(byDate.keys()).sort();

  if (dates.length === 0) {
    return (
      <div className="card text-center text-sm text-muted-foreground">
        No scheduled jobs in this window. Set due dates on projects to see them here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dates.map((date) => {
        const items = byDate.get(date) ?? [];
        const d = new Date(date + "T12:00:00");
        const isPast = d < new Date(new Date().toDateString());

        return (
          <div key={date} className={`card ${isPast ? "border-danger/30" : ""}`}>
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              {isPast && <span className="ml-2 text-xs text-danger">Overdue window</span>}
            </h3>
            <ul className="space-y-2">
              {items.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-elevated px-3 py-2 text-sm">
                  <div>
                    <Link href={`/projects/${p.id}`} className="link font-medium">
                      {p.projectNumber}
                    </Link>
                    <span className="text-muted-foreground"> — {p.title}</span>
                    <p className="text-xs text-muted-foreground">{p.client.name}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {p.assignments.length > 0
                      ? p.assignments.map((a) => `${a.fielder.firstName} ${a.fielder.lastName}`).join(", ")
                      : "Unassigned"}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
