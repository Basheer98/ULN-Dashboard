import { StatusBadge } from "@/components/layout";
import { FinanceHeader } from "@/components/finance/finance-nav";
import { prisma } from "@/lib/prisma";
import { formatCurrency, toNumber } from "@uln/shared";
import Link from "next/link";

export default async function ReconciliationListPage() {
  const reconciliations = await prisma.bankReconciliation.findMany({
    orderBy: { statementDate: "desc" },
    include: { paymentMethod: true },
  });

  return (
    <>
      <FinanceHeader title="Reconciliation" subtitle="Bank account reconciliation" />
      <main className="page-main space-y-6">
        <div className="flex justify-end">
          <Link href="/finance/reconciliation/new" className="btn-primary">
            New Reconciliation
          </Link>
        </div>

        {reconciliations.length === 0 ? (
          <div className="card text-center text-sm text-muted-foreground">
            No reconciliations yet. Start one to match bank statements.
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Statement Date</th>
                  <th>Account</th>
                  <th>Starting</th>
                  <th>Ending</th>
                  <th>Difference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations.map((rec) => (
                  <tr key={rec.id}>
                    <td>
                      <Link href={`/finance/reconciliation/${rec.id}`} className="link">
                        {rec.statementDate.toLocaleDateString()}
                      </Link>
                    </td>
                    <td>{rec.paymentMethod.name}</td>
                    <td>{formatCurrency(toNumber(rec.startingBalance))}</td>
                    <td>{formatCurrency(toNumber(rec.endingBalance))}</td>
                    <td className={Math.abs(toNumber(rec.difference)) > 0.01 ? "text-danger" : "text-success"}>
                      {formatCurrency(toNumber(rec.difference))}
                    </td>
                    <td><StatusBadge status={rec.status} /></td>
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
