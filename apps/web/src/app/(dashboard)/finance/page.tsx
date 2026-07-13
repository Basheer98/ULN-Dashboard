import { StatusBadge } from "@/components/layout";
import { FinanceHeader } from "@/components/finance/finance-nav";
import { ExpensesByCategoryChart } from "@/components/finance/finance-charts";
import { ChartCard } from "@/components/charts";
import { prisma } from "@/lib/prisma";
import { getFinanceDashboardStats, transactionInclude } from "@/lib/finance-transactions";
import { formatCurrency, formatStatus, toNumber } from "@uln/shared";
import Link from "next/link";

export default async function FinanceDashboardPage() {
  const [stats, recentTransactions] = await Promise.all([
    getFinanceDashboardStats(),
    prisma.financialTransaction.findMany({
      where: { deletedAt: null },
      orderBy: { transactionDate: "desc" },
      take: 10,
      include: transactionInclude,
    }),
  ]);

  const kpis = [
    { label: "Income", value: formatCurrency(stats.income), className: "text-success" },
    { label: "Expenses", value: formatCurrency(stats.expenses), className: "text-danger" },
    { label: "Net Income", value: formatCurrency(stats.netIncome), className: "" },
    { label: "Outstanding Invoices", value: formatCurrency(stats.outstandingInvoices), className: "" },
    { label: "Pending Reimbursements", value: stats.pendingReimbursements.toString(), className: "" },
    { label: "Cash on Hand", value: formatCurrency(stats.cashOnHand), className: "text-accent" },
  ];

  return (
    <>
      <FinanceHeader title="Finance" subtitle="Overview — income, expenses, and cash position" />
      <main className="page-main space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="stat-card">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className={`mt-2 text-2xl font-semibold ${kpi.className}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <ChartCard title="Expenses by Category" subtitle="All time">
          <ExpensesByCategoryChart data={stats.expensesByCategory} />
        </ChartCard>

        <section className="card overflow-x-auto">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Transactions</h2>
            <Link href="/finance/expenses" className="link text-sm">
              View all →
            </Link>
          </div>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Number</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.transactionDate.toLocaleDateString()}</td>
                    <td>
                      {tx.transactionType === "expense" ? (
                        <Link href={`/finance/expenses/${tx.id}`} className="link">
                          {tx.transactionNumber}
                        </Link>
                      ) : (
                        tx.transactionNumber
                      )}
                    </td>
                    <td>{formatStatus(tx.transactionType)}</td>
                    <td>{tx.description || tx.category?.name || "—"}</td>
                    <td>{formatCurrency(toNumber(tx.amount))}</td>
                    <td>
                      {tx.expenseStatus ? (
                        <StatusBadge status={tx.expenseStatus} />
                      ) : (
                        "—"
                      )}
                    </td>
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
