import { FinanceHeader } from "@/components/finance/finance-nav";
import { prisma } from "@/lib/prisma";
import { getProjectProfitability } from "@/lib/finance-transactions";
import { formatCurrency, toNumber } from "@uln/shared";
import Link from "next/link";

export default async function ProfitabilityPage() {
  const [projects, fielders] = await Promise.all([
    prisma.project.findMany({
      where: {
        deletedAt: null,
        status: { in: ["complete", "invoiced", "paid", "in_progress", "assigned"] },
      },
      orderBy: { completedAt: "desc" },
      include: { client: true },
    }),
    prisma.fielder.findMany({
      where: { isActive: true },
      include: {
        assignments: {
          include: { project: true },
        },
        payments: true,
      },
    }),
  ]);

  const rows = await Promise.all(projects.map((p) => getProjectProfitability(p.id)));
  rows.sort((a, b) => b.profit - a.profit);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalProfit = rows.reduce((s, r) => s + r.profit, 0);
  const avgMargin =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.margin, 0) / rows.length)
      : 0;

  const fielderRows = fielders
    .map((f) => {
      const paid = f.payments.reduce((s, p) => s + toNumber(p.amountPaid), 0);
      const pending = f.payments.reduce(
        (s, p) => s + Math.max(0, toNumber(p.totalAmount) - toNumber(p.amountPaid)),
        0
      );
      const activeAssignments = f.assignments.filter((a) => !a.project.deletedAt);
      const sqft = activeAssignments.reduce((s, a) => s + toNumber(a.assignedSqft), 0);
      return {
        id: f.id,
        name: `${f.firstName} ${f.lastName}`,
        sqft,
        jobs: activeAssignments.length,
        paid,
        pending,
      };
    })
    .sort((a, b) => b.paid - a.paid);

  return (
    <>
      <FinanceHeader title="Profitability" subtitle="Project and fielder performance over time" />
      <main className="page-main space-y-6">
        <Link href="/finance/profitability/states" className="link text-sm">
          View profit by state (travel, hotels, gas) →
        </Link>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Total Profit</p>
            <p className={`mt-2 text-2xl font-semibold ${totalProfit >= 0 ? "text-success" : "text-danger"}`}>
              {formatCurrency(totalProfit)}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Avg Margin</p>
            <p className="mt-2 text-2xl font-semibold">{avgMargin}%</p>
          </div>
        </div>

        <section className="card">
          <h2 className="mb-4 font-semibold text-foreground">By Project</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects to analyze yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Client</th>
                  <th>Revenue</th>
                  <th>Expenses</th>
                  <th>Profit</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ project, revenue, directExpenses, allocatedExpenses, profit, margin }) => (
                  <tr key={project.id}>
                    <td>
                      <Link href={`/projects/${project.id}`} className="link">
                        {project.projectNumber}
                      </Link>
                    </td>
                    <td>{project.client.name}</td>
                    <td>{formatCurrency(revenue)}</td>
                    <td>{formatCurrency(directExpenses + allocatedExpenses)}</td>
                    <td className={profit >= 0 ? "text-success" : "text-danger"}>
                      {formatCurrency(profit)}
                    </td>
                    <td>{margin}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2 className="mb-4 font-semibold text-foreground">By Fielder</h2>
          {fielderRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fielders yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fielder</th>
                  <th>Jobs</th>
                  <th>SQFT</th>
                  <th>Paid</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {fielderRows.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/fielders/${f.id}`} className="link">
                        {f.name}
                      </Link>
                    </td>
                    <td>{f.jobs}</td>
                    <td>{f.sqft.toLocaleString()}</td>
                    <td className="text-success">{formatCurrency(f.paid)}</td>
                    <td className="text-warning">{formatCurrency(f.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
