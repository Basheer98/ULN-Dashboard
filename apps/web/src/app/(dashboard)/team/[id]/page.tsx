import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatCurrency, hasPermission } from "@uln/shared";
import { Header, StatusBadge } from "@/components/layout";
import { TeamMemberActions } from "@/components/team-member-actions";
import {
  TeamMemberEditForm,
  TeamMemberSessions,
  type SessionRow,
} from "@/components/team-member-profile-controls";
import { getSessionUser } from "@/lib/auth";
import { describeDevice, getTeamMemberProfile } from "@/lib/team-profile";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  dispatcher: "Dispatcher",
  accountant: "Accountant",
  coordinator: "Project coordinator",
};

const LOGIN_REASON_LABELS: Record<string, string> = {
  invalid_credentials: "Wrong email or password",
  locked: "Blocked (too many failed attempts)",
  inactive: "Account inactive",
};

function formatWhen(date: Date) {
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="stat-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function TeamMemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getSessionUser();
  if (!viewer || !hasPermission(viewer.role, "users:write")) redirect("/dashboard");

  const { id } = await params;
  const profile = await getTeamMemberProfile(id);
  if (!profile) notFound();

  const { user, sessions, loginAttempts, recentFailures, work, finance, timeline } = profile;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const isSelf = user.id === viewer.id;

  const sessionRows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    device: describeDevice(s.userAgent, s.client),
    ipAddress: s.ipAddress,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    isCurrent: s.id === viewer.sessionId,
  }));

  return (
    <>
      <Header
        title={name}
        subtitle={`${ROLE_LABELS[user.role] ?? user.role} · ${user.isActive ? "Active" : "Removed"}`}
        backHref="/team"
        backLabel="Back to team"
      />
      <main className="page-main space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-semibold text-foreground">Account</h2>
              <TeamMemberActions
                userId={user.id}
                name={name}
                isActive={user.isActive}
                isSelf={isSelf}
                afterRemoveHref="/team"
              />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">{user.email}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd>{ROLE_LABELS[user.role] ?? user.role}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <span className={`badge ${user.isActive ? "badge-success" : "badge-danger"}`}>
                  {user.isActive ? "Active" : "Removed — can't sign in"}
                </span>
              </dd>
              <dt className="text-muted-foreground">Added</dt>
              <dd>{formatWhen(user.createdAt)}</dd>
              <dt className="text-muted-foreground">Last sign-in</dt>
              <dd>{user.lastLoginAt ? formatWhen(user.lastLoginAt) : "Never"}</dd>
              <dt className="text-muted-foreground">Failed sign-ins (24h)</dt>
              <dd className={recentFailures > 0 ? "text-warning" : undefined}>{recentFailures}</dd>
            </dl>
          </section>

          <TeamMemberEditForm
            userId={user.id}
            firstName={user.firstName ?? ""}
            lastName={user.lastName ?? ""}
            role={user.role}
            isSelf={isSelf}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Projects created"
            value={work.projectsCreatedTotal}
            hint={`${work.projectsCreatedThisMonth} this month`}
          />
          <Stat label="Status changes" value={work.statusChanges} />
          <Stat label="Photos & files uploaded" value={work.uploadsTotal} />
          <Stat label="Active sessions" value={sessions.length} />
        </div>

        {finance && (
          <section className="card space-y-4">
            <div>
              <h2 className="font-semibold text-foreground">Finance activity</h2>
              <p className="text-sm text-muted-foreground">
                Shown for admin and accountant accounts only.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Expenses entered"
                value={finance.expensesCreated}
                hint={formatCurrency(finance.expensesCreatedAmount)}
              />
              <Stat label="Expenses reviewed" value={finance.expensesReviewed} />
              <Stat label="Receipts uploaded" value={finance.receiptsUploaded} />
              <Stat
                label="Fielder payments recorded"
                value={finance.fielderPaymentsRecorded}
                hint={formatCurrency(finance.fielderPaymentsAmount)}
              />
            </div>
          </section>
        )}

        <TeamMemberSessions userId={user.id} sessions={sessionRows} canManage />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card space-y-3">
            <h2 className="font-semibold text-foreground">Recent projects created</h2>
            {work.recentProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects created yet.</p>
            ) : (
              <ul className="space-y-2">
                {work.recentProjects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm hover:bg-surface-hover"
                    >
                      <span className="min-w-0">
                        <span className="font-medium text-foreground">{p.projectNumber}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.title} · {p.client.name} · {p.createdAt.toLocaleDateString()}
                        </span>
                      </span>
                      <StatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card space-y-3">
            <h2 className="font-semibold text-foreground">Sign-in history</h2>
            {loginAttempts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sign-in attempts recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-0 md:min-w-0">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Result</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginAttempts.map((a) => (
                      <tr key={a.id}>
                        <td className="whitespace-nowrap">{formatWhen(a.createdAt)}</td>
                        <td className={a.success ? "text-success" : "text-danger"}>
                          {a.success ? "Signed in" : LOGIN_REASON_LABELS[a.reason ?? ""] ?? "Failed"}
                        </td>
                        <td className="text-muted-foreground">{a.ipAddress ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <section className="card space-y-3">
          <h2 className="font-semibold text-foreground">Activity timeline</h2>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {timeline.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm"
                >
                  <span className="text-foreground">
                    {entry.kind === "finance" && (
                      <span className="mr-2 rounded bg-accent-muted px-1.5 py-0.5 text-xs text-accent">
                        Finance
                      </span>
                    )}
                    {entry.href ? (
                      <Link href={entry.href} className="hover:underline">
                        {entry.text}
                      </Link>
                    ) : (
                      entry.text
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatWhen(entry.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
