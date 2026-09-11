function formatWhen(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type ActivityRow = {
  id: string;
  action: string;
  createdAt: Date | string;
  metadata: unknown;
  user: { email: string; firstName: string | null; lastName: string | null } | null;
};

function metaSummary(row: ActivityRow): { summary: string; email: string | null } {
  const meta =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};
  const email =
    (typeof meta.userEmail === "string" && meta.userEmail) || row.user?.email || null;
  const summary =
    (typeof meta.summary === "string" && meta.summary) ||
    `${row.action} by ${email || "unknown"}`;
  return { summary, email };
}

export function ProjectActivityTimeline({ activities }: { activities: ActivityRow[] }) {
  return (
    <section className="card">
      <h2 className="mb-4 font-semibold text-foreground">Activity</h2>
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {activities.map((row) => {
            const { summary, email } = metaSummary(row);
            return (
              <li
                key={row.id}
                className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm"
              >
                <p className="font-medium text-foreground">{summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatWhen(row.createdAt)}
                  {email ? ` · ${email}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
