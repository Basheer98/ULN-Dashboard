import { Header, StatusBadge } from "@/components/layout";
import {
  ChartCard,
  SqftAreaChart,
  StatusDonut,
  TopFieldersChart,
} from "@/components/charts";
import { prisma } from "@/lib/prisma";
import { getDashboardAnalytics } from "@/lib/analytics";
import { getOverdueItems } from "@/lib/overdue";
import { formatCurrency, toNumber } from "@uln/shared";
import Link from "next/link";

export default async function DashboardPage() {
  const [
    activeProjects,
    completedProjects,
    pendingPayments,
    unpaidInvoices,
    recentProjects,
    analytics,
    overdue,
  ] = await Promise.all([
    prisma.project.count({ where: { status: { in: ["assigned", "in_progress"] } } }),
    prisma.project.count({ where: { status: "complete" } }),
    prisma.fielderPayment.count({ where: { status: { in: ["pending", "approved"] } } }),
    prisma.invoice.count({ where: { status: { in: ["sent", "overdue", "partial"] } } }),
    prisma.project.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { client: true, assignments: { include: { fielder: true } } },
    }),
    getDashboardAnalytics(),
    getOverdueItems(),
  ]);

  const { totals } = analytics;
  const hasOverdue =
    overdue.overdueInvoices.length > 0 || overdue.overdueProjects.length > 0;

  const stats = [
    { label: "Active Projects", value: activeProjects.toString(), href: "/projects" },
    { label: "SQFT Completed", value: totals.completedSqft.toLocaleString(), href: "/reports" },
    { label: "Fielders Working", value: totals.activeFielders.toString(), href: "/fielders" },
    { label: "Est. Margin", value: formatCurrency(totals.margin), href: "/reports" },
    { label: "Awaiting Invoice", value: completedProjects.toString(), href: "/projects" },
    { label: "Pending Payouts", value: pendingPayments.toString(), href: "/payments" },
    { label: "Unpaid Invoices", value: unpaidInvoices.toString(), href: "/invoices" },
    { label: "Total SQFT", value: totals.totalSqft.toLocaleString(), href: "/reports" },
  ];

  return (
    <>
      <Header title="Dashboard" subtitle="Urbanlink Networks — operations overview" />
      <main className="page-main space-y-6">
        {hasOverdue && (
          <section className="card border-danger/30">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-foreground">Overdue & Aging</h2>
              <Link href="/schedule" className="link text-sm">View schedule</Link>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {overdue.overdueInvoices.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-danger">Past-due invoices</h3>
                  <ul className="space-y-2 text-sm">
                    {overdue.overdueInvoices.slice(0, 5).map((inv) => (
                      <li key={inv.id} className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
                        <span className="min-w-0 truncate">{inv.invoiceNumber} — {inv.client.name}</span>
                        <span className="shrink-0 font-medium">{formatCurrency(toNumber(inv.totalAmount))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {overdue.overdueProjects.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-danger">Jobs past due date</h3>
                  <ul className="space-y-2 text-sm">
                    {overdue.overdueProjects.slice(0, 5).map((p) => (
                      <li key={p.id} className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
                        <Link href={`/projects/${p.id}`} className="link min-w-0 truncate">
                          {p.projectNumber}
                        </Link>
                        <span className="shrink-0 text-muted-foreground">{p.dueDate?.toLocaleDateString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Link key={stat.label} href={stat.href} className="stat-card">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</p>
            </Link>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <ChartCard title="SQFT Completed" subtitle="Last 6 months" className="lg:col-span-2">
            <SqftAreaChart data={analytics.sqftByMonth} />
          </ChartCard>
          <ChartCard title="Projects by Status" subtitle="Current pipeline">
            <StatusDonut data={analytics.projectsByStatus} />
          </ChartCard>
        </div>

        <ChartCard title="Top Fielders by SQFT" subtitle="Across all assigned jobs">
          <TopFieldersChart data={analytics.topFielders} />
        </ChartCard>

        <section className="card">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Projects</h2>
            <Link href="/projects" className="link text-sm">View all</Link>
          </div>
          {recentProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet. Create your first project.</p>
          ) : (
            <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Client</th>
                    <th>SQFT</th>
                    <th>Client Bill</th>
                    <th>Fielder</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProjects.map((project) => {
                    const bill = toNumber(project.sqft) * toNumber(project.clientSqftRate);
                    const fielder = project.assignments[0]?.fielder;
                    return (
                      <tr key={project.id}>
                        <td>
                          <Link href={`/projects/${project.id}`} className="link">
                            {project.projectNumber}
                          </Link>
                          <p className="text-xs text-muted-foreground">{project.title}</p>
                        </td>
                        <td>{project.client.name}</td>
                        <td>{toNumber(project.sqft).toLocaleString()}</td>
                        <td>{formatCurrency(bill)}</td>
                        <td>{fielder ? `${fielder.firstName} ${fielder.lastName}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          )}
        </section>
      </main>
    </>
  );
}
