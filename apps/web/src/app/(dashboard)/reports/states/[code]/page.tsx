import { Header, StatusBadge } from "@/components/layout";
import { getStateAnalytics } from "@/lib/state-analytics";
import { formatCurrency, formatRate, toNumber, stateName, US_STATES } from "@uln/shared";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function StateDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const stateCode = code.toUpperCase();
  if (!US_STATES.some((s) => s.code === stateCode)) notFound();

  const analytics = await getStateAnalytics(stateCode);

  const stats = [
    { label: "Projects", value: analytics.projectCount.toLocaleString() },
    { label: "Active", value: analytics.activeProjects.toLocaleString() },
    { label: "Total SQFT", value: analytics.totalSqft.toLocaleString() },
    { label: "Completed SQFT", value: analytics.completedSqft.toLocaleString() },
    { label: "Est. Revenue", value: formatCurrency(analytics.totalRevenue) },
    { label: "Fielder Payout", value: formatCurrency(analytics.totalPayout) },
    { label: "Est. Margin", value: formatCurrency(analytics.margin) },
  ];

  return (
    <>
      <Header
        title={analytics.stateName}
        subtitle={`State operations — ${stateCode}`}
      />
      <main className="page-main space-y-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/reports" className="link">← Back to Reports</Link>
          <Link href={`/projects?state=${stateCode}`} className="link">
            View all {stateCode} projects
          </Link>
          <Link href="/rates" className="link">Manage state rates</Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="card overflow-x-auto">
          <h2 className="mb-4 font-semibold text-foreground">Projects in {analytics.stateName}</h2>
          {analytics.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects in this state yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Client</th>
                  <th>SQFT</th>
                  <th>Rate</th>
                  <th>Client Bill</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {analytics.projects.map((p) => {
                  const bill = toNumber(p.sqft) * toNumber(p.clientSqftRate);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/projects/${p.id}`} className="link">
                          {p.projectNumber}
                        </Link>
                        <p className="text-xs text-muted-foreground">{p.title}</p>
                      </td>
                      <td>{p.client.name}</td>
                      <td>{toNumber(p.sqft).toLocaleString()}</td>
                      <td>{formatRate(toNumber(p.clientSqftRate))}</td>
                      <td>{formatCurrency(bill)}</td>
                      <td><StatusBadge status={p.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
