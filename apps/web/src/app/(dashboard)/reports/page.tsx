import { Suspense } from "react";
import { Header, StatusBadge } from "@/components/layout";
import { ReportsToolbar } from "@/components/reports-toolbar";
import {
  ChartCard,
  FinanceBarChart,
  FielderMixDonut,
  JobTypeChart,
  SqftAreaChart,
  SqftByClientChart,
  SqftByStateChart,
  StatusDonut,
  TopFieldersChart,
} from "@/components/charts";
import { getDashboardAnalytics } from "@/lib/analytics";
import { parseDateRangeParams, formatCurrency, stateName } from "@uln/shared";
import Link from "next/link";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string; state?: string }>;
}) {
  const params = await searchParams;
  const sp = new URLSearchParams();
  if (params.preset) sp.set("preset", params.preset);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const range = parseDateRangeParams(sp);
  const analytics = await getDashboardAnalytics(range, { state: params.state });
  const { totals } = analytics;

  const stats = [
    { label: "Total Projects", value: totals.projectCount.toLocaleString() },
    { label: "Total SQFT", value: totals.totalSqft.toLocaleString() },
    { label: "SQFT Completed", value: totals.completedSqft.toLocaleString() },
    { label: "Fielders Working", value: totals.activeFielders.toLocaleString() },
    { label: "Est. Revenue", value: formatCurrency(totals.totalRevenue) },
    { label: "Fielder Payout", value: formatCurrency(totals.totalPayout) },
    { label: "Est. Margin", value: formatCurrency(totals.margin) },
    {
      label: "Margin %",
      value: totals.totalRevenue > 0 ? `${Math.round((totals.margin / totals.totalRevenue) * 100)}%` : "—",
    },
  ];

  return (
    <>
      <Header title="Reports" subtitle={params.state ? `Filtered to ${stateName(params.state)}` : "Business analytics and performance"} />
      <main className="page-main space-y-6">
        <Suspense fallback={<div className="card h-16 animate-pulse" />}>
          <ReportsToolbar />
        </Suspense>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        <ChartCard title="Revenue vs Fielder Pay vs Margin" subtitle="Selected date range">
          <FinanceBarChart data={analytics.financeByMonth} />
        </ChartCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="SQFT Completed" subtitle="Selected date range">
            <SqftAreaChart data={analytics.sqftByMonth} />
          </ChartCard>
          <ChartCard title="Projects by Status" subtitle="Filtered pipeline">
            <StatusDonut data={analytics.projectsByStatus} />
          </ChartCard>
        </div>

        <ChartCard title="Top Fielders by SQFT" subtitle="Click a fielder for detail">
          <TopFieldersChart data={analytics.topFielders} />
        </ChartCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="SQFT by Client" subtitle="Click a client for detail">
            <SqftByClientChart data={analytics.sqftByClient} />
          </ChartCard>
          <ChartCard title="SQFT by Job Type" subtitle="Work distribution">
            <JobTypeChart data={analytics.sqftByJobType} />
          </ChartCard>
        </div>

        <ChartCard title="SQFT & Revenue by State" subtitle="Click a state for full breakdown">
          <SqftByStateChart data={analytics.sqftByState} />
        </ChartCard>

        {analytics.sqftByState.length > 0 && (
          <div className="card overflow-x-auto">
            <h3 className="mb-4 text-sm font-semibold text-foreground">State breakdown</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>SQFT</th>
                  <th>Est. Revenue</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {analytics.sqftByState.map((s) => (
                  <tr key={s.code}>
                    <td>{s.name}</td>
                    <td>{s.sqft.toLocaleString()}</td>
                    <td>{formatCurrency(s.revenue)}</td>
                    <td>
                      <Link href={`/reports/states/${s.code}`} className="link text-sm">
                        View details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Fielder Mix" subtitle="1099 vs W-2">
            <FielderMixDonut data={analytics.fielderMix} />
          </ChartCard>
          <div className="card">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Fielder Productivity</h3>
            {analytics.topFielders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fielder</th>
                      <th>Jobs</th>
                      <th>SQFT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topFielders.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <Link href={`/fielders/${f.id}`} className="link">
                            {f.name}
                          </Link>
                        </td>
                        <td>{f.jobs}</td>
                        <td>{f.sqft.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
