import { FinanceHeader } from "@/components/finance/finance-nav";
import { IncomeForm } from "@/components/finance/finance-forms";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatStatus, toNumber } from "@uln/shared";
import Link from "next/link";

export default async function IncomePage() {
  const [income, clients, projects, paymentMethods] = await Promise.all([
    prisma.financialTransaction.findMany({
      where: { deletedAt: null, transactionType: "income" },
      orderBy: { transactionDate: "desc" },
      include: { client: true, project: true, paymentMethod: true },
    }),
    prisma.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <FinanceHeader title="Income" subtitle="Client payments and other income" />
      <main className="page-main space-y-6">
        <IncomeForm
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          projects={projects.map((p) => ({ id: p.id, name: p.projectNumber }))}
          paymentMethods={paymentMethods.map((pm) => ({ id: pm.id, name: pm.name }))}
        />

        {income.length === 0 ? (
          <div className="card text-center text-sm text-muted-foreground">No income recorded yet.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Number</th>
                  <th>Category</th>
                  <th>Client</th>
                  <th>Project</th>
                  <th>Amount</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {income.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.transactionDate.toLocaleDateString()}</td>
                    <td>{tx.transactionNumber}</td>
                    <td>{tx.incomeCategory ? formatStatus(tx.incomeCategory) : "—"}</td>
                    <td>{tx.client?.name || "—"}</td>
                    <td>
                      {tx.project ? (
                        <Link href={`/projects/${tx.projectId}`} className="link">
                          {tx.project.projectNumber}
                        </Link>
                      ) : "—"}
                    </td>
                    <td>{formatCurrency(toNumber(tx.amount))}</td>
                    <td>{tx.paymentMethod?.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
