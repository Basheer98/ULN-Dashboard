import { redirect } from "next/navigation";
import { Header } from "@/components/layout";
import {
  ChartCard,
  SqftAreaChart,
  StatusDonut,
  TopFieldersChart,
} from "@/components/charts";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getDashboardAnalytics } from "@/lib/analytics";
import { getDashboardData, type BreakEvenProgress, type Trend } from "@/lib/dashboard";
import { getOverdueItems } from "@/lib/overdue";
import { formatCurrency, toNumber } from "@uln/shared";
import Link from "next/link";

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

function TrendLine({ trend }: { trend: Trend }) {
  const { current, previous } = trend;
  if (previous === 0) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        {current === 0 ? "None yet, same as last month" : "None at this point last month"}
      </p>
    );
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(change);
  const tone = rounded > 0 ? "text-success" : rounded < 0 ? "text-danger" : "text-muted-foreground";
  const arrow = rounded > 0 ? "↑" : rounded < 0 ? "↓" : "→";
  return (
    <p className={`mt-1 text-xs ${tone}`}>
      {arrow} {Math.abs(rounded)}% vs same point last month
    </p>
  );
}

type Card = {
  label: string;
  value: string;
  href: string;
  hint?: string;
  trend?: Trend;
};

function BreakEvenCard({ progress, monthLabel }: { progress: BreakEvenProgress; monthLabel: string }) {
  if (progress.state !== "ready") {
    return (
      <section className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-foreground">Break-even Progress</h2>
          <p className="text-sm text-muted-foreground">
            {progress.state === "no_costs"
              ? "Add your recurring operating costs to see how much SQFT you need each month to cover them."
              : "Break-even needs completed projects from the last 3 months to work out your margin per SQFT."}
          </p>
        </div>
        <Link href="/finance/operations" className="link shrink-0 text-sm">
          {progress.state === "no_costs" ? "Set up operating costs" : "Open Operations Cost"}
        </Link>
      </section>
    );
  }

  const { targetSqft, completedSqft, monthProgress } = progress;
  const pct = targetSqft > 0 ? completedSqft / targetSqft : 0;
  const expected = targetSqft * monthProgress;
  const reached = completedSqft >= targetSqft;
  const onPace = completedSqft >= expected;
  const barTone = reached ? "bg-success" : onPace ? "bg-accent" : "bg-warning";

  return (
    <section className="card space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="font-semibold text-foreground">Break-even Progress — {monthLabel}</h2>
        <Link href="/finance/operations" className="link text-sm">
          Operations Cost
        </Link>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-surface-hover">
        <div className={`h-full ${barTone}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
        {!reached && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/60"
            style={{ left: `${Math.min(100, monthProgress * 100)}%` }}
            title="Where you should be by today"
          />
        )}
      </div>
      <p className="text-sm">
        <span className="font-semibold">{formatNumber(completedSqft)}</span> of{" "}
        {formatNumber(targetSqft)} SQFT completed ({Math.round(pct * 100)}%).{" "}
        <span className={reached || onPace ? "text-success" : "text-warning"}>
          {reached
            ? "Break-even reached — everything from here is profit."
            : onPace
              ? "On pace to break even."
              : `Behind pace by ${formatNumber(expected - completedSqft)} SQFT.`}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        The target uses your fixed costs and average margin per SQFT from the last 3 full months. The line
        marks where you should be by today.
      </p>
    </section>
  );
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [data, recentProjects, analytics, overdue] = await Promise.all([
    getDashboardData(user.role),
    prisma.project.findMany({
      where: { deletedAt: null },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { client: true, assignments: { include: { fielder: true } } },
    }),
    getDashboardAnalytics(),
    getOverdueItems(),
  ]);

  const { trends, canSeeMoney } = data;
  const overdueInvoices = data.canSeeInvoices ? overdue.overdueInvoices : [];
  const hasOverdue = overdueInvoices.length > 0 || overdue.overdueProjects.length > 0;

  const cards: Card[] = [
    { label: "Active Projects", value: data.activeProjectCount.toString(), href: "/projects" },
    {
      label: `SQFT Completed (${data.monthLabel})`,
      value: formatNumber(trends.sqft.current),
      href: "/reports",
      trend: trends.sqft,
    },
    {
      label: `Projects Completed (${data.monthLabel})`,
      value: trends.completed.current.toString(),
      href: "/projects",
      trend: trends.completed,
    },
    { label: "Fielders Working", value: analytics.totals.activeFielders.toString(), href: "/fielders" },
  ];

  if (canSeeMoney) {
    if (trends.billed) {
      cards.push({
        label: `Billed (${data.monthLabel})`,
        value: formatCurrency(trends.billed.current),
        href: "/reports",
        trend: trends.billed,
      });
    }
    if (trends.margin) {
      cards.push({
        label: `Margin after fielder pay (${data.monthLabel})`,
        value: formatCurrency(trends.margin.current),
        href: "/finance/profitability",
        trend: trends.margin,
      });
    }
    if (data.unpaidInvoices) {
      cards.push({
        label: "Unpaid Invoices",
        value: formatCurrency(data.unpaidInvoices.amount),
        hint: `${data.unpaidInvoices.count} invoice${data.unpaidInvoices.count === 1 ? "" : "s"}`,
        href: "/invoices",
      });
    }
    if (data.cashOnHand != null) {
      cards.push({ label: "Cash on Hand", value: formatCurrency(data.cashOnHand), href: "/finance" });
    }
  } else {
    cards.push(
      {
        label: `New Projects (${data.monthLabel})`,
        value: trends.created.current.toString(),
        href: "/projects",
        trend: trends.created,
      },
      { label: "Unassigned Projects", value: data.unassignedProjects.toString(), href: "/projects?status=draft" },
      { label: "Due This Week", value: data.dueThisWeek.toString(), href: "/schedule" },
      { label: "Active Pipeline SQFT", value: formatNumber(data.pipelineSqft), href: "/projects" }
    );
  }

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
              {overdueInvoices.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-danger">Past-due invoices</h3>
                  <ul className="space-y-2 text-sm">
                    {overdueInvoices.slice(0, 5).map((inv) => (
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
          {cards.map((card) => (
            <Link key={card.label} href={card.href} className="stat-card">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
              {card.trend && <TrendLine trend={card.trend} />}
              {card.hint && <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>}
            </Link>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="card lg:col-span-1">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Needs Attention</h2>
            {data.attention.length === 0 ? (
              <p className="text-sm text-muted-foreground">All caught up — nothing waiting on you.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.attention.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-accent"
                    >
                      <span className="min-w-0">
                        <span className="block">{item.label}</span>
                        {item.amount != null && item.amount > 0 && (
                          <span className="block text-xs text-muted-foreground">{formatCurrency(item.amount)}</span>
                        )}
                      </span>
                      <span className="badge badge-warning shrink-0">{item.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="space-y-6 lg:col-span-2">
            {data.breakEven && <BreakEvenCard progress={data.breakEven} monthLabel={data.monthLabel} />}
            <ChartCard title="SQFT Completed" subtitle="Last 6 months">
              <SqftAreaChart data={analytics.sqftByMonth} />
            </ChartCard>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <ChartCard title="Projects by Status" subtitle="Current pipeline">
            <StatusDonut data={analytics.projectsByStatus} />
          </ChartCard>
          <ChartCard title="Top Fielders by SQFT" subtitle="Across all assigned jobs" className="lg:col-span-2">
            <TopFieldersChart data={analytics.topFielders} />
          </ChartCard>
        </div>

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
                    {canSeeMoney && <th>Client Bill</th>}
                    <th>Fielder</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProjects.map((project) => {
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
                        {canSeeMoney && (
                          <td>{formatCurrency(toNumber(project.sqft) * toNumber(project.clientSqftRate))}</td>
                        )}
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
