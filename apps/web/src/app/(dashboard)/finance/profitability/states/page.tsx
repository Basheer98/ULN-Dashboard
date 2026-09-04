import { FinanceHeader } from "@/components/finance/finance-nav";
import { getStateProfitability } from "@/lib/finance-transactions";
import { formatCurrency } from "@uln/shared";
import Link from "next/link";

export default async function StateProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from ? new Date(params.from) : undefined;
  const to = params.to ? new Date(params.to) : undefined;

  const rows = await getStateProfitability({ from, to });
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;

  return (
    <>
      <FinanceHeader
        title="Profit by State"
        subtitle="Travel and job spend vs project revenue, grouped by work state"
      />
      <main className="page-main space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/finance/profitability" className="link text-sm">
            ← Back to profitability
          </Link>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">From</label>
              <input name="from" type="date" defaultValue={params.from ?? ""} className="w-full" />
            </div>
            <div>
              <label className="label">To</label>
              <input name="to" type="date" defaultValue={params.to ?? ""} className="w-full" />
            </div>
            <button type="submit" className="btn-secondary">
              Filter
            </button>
          </form>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Revenue (by project state)</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Expenses (work state)</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Profit</p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                totalProfit >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {formatCurrency(totalProfit)}
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="card text-sm text-muted-foreground">
            No state data yet. Set a project state or choose Work state when entering expenses
            (Travel → Airfare, Fuel, Lodging, Rental Car).
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <section key={row.state} className="card space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-foreground">
                      {row.stateLabel} ({row.state})
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {row.projectCount} project{row.projectCount === 1 ? "" : "s"} ·{" "}
                      {row.expenseCount} expense{row.expenseCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Link href={`/finance/expenses?state=${row.state}`} className="link text-sm">
                    View expenses →
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Revenue</p>
                    <p className="font-medium">{formatCurrency(row.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expenses</p>
                    <p className="font-medium">{formatCurrency(row.expenses)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Profit</p>
                    <p
                      className={`font-medium ${
                        row.profit >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {formatCurrency(row.profit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Margin</p>
                    <p className="font-medium">{row.margin}%</p>
                  </div>
                </div>

                {row.categories.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Category / travel type</th>
                          <th>Spend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.categories.map((c) => (
                          <tr key={c.key}>
                            <td>{c.label}</td>
                            <td>{formatCurrency(c.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No expenses tagged to this state.</p>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
