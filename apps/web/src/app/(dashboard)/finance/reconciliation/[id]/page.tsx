import { StatusBadge } from "@/components/layout";
import { FinanceHeader } from "@/components/finance/finance-nav";
import {
  ReconciliationActions,
  ReconciliationItemToggle,
} from "@/components/finance/finance-actions";
import { BankStatementImport } from "@/components/finance/bank-statement-import";
import { prisma } from "@/lib/prisma";
import { formatCurrency, toNumber } from "@uln/shared";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ReconciliationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reconciliation = await prisma.bankReconciliation.findUnique({
    where: { id },
    include: {
      paymentMethod: true,
      items: {
        orderBy: { transactionDate: "asc" },
        include: { transaction: true },
      },
    },
  });

  if (!reconciliation) notFound();

  const difference = toNumber(reconciliation.difference);
  const canEdit =
    reconciliation.status === "in_progress" || reconciliation.status === "balanced";

  return (
    <>
      <FinanceHeader
        title="Reconciliation Detail"
        subtitle={`${reconciliation.paymentMethod.name} — ${reconciliation.statementDate.toLocaleDateString()}`}
      />
      <main className="page-main space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/finance/reconciliation" className="link text-sm">
            ← Back to reconciliations
          </Link>
          <ReconciliationActions
            reconciliationId={reconciliation.id}
            status={reconciliation.status}
            difference={difference}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Starting Balance</p>
            <p className="mt-2 text-xl font-semibold">
              {formatCurrency(toNumber(reconciliation.startingBalance))}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Ending Balance</p>
            <p className="mt-2 text-xl font-semibold">
              {formatCurrency(toNumber(reconciliation.endingBalance))}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Cleared Total</p>
            <p className="mt-2 text-xl font-semibold">
              {formatCurrency(toNumber(reconciliation.clearedTotal))}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="mt-2">
              <StatusBadge status={reconciliation.status} />
            </p>
          </div>
        </div>

        <BankStatementImport reconciliationId={reconciliation.id} disabled={!canEdit} />

        <div className="card overflow-x-auto">
          <h2 className="mb-4 font-semibold text-foreground">Reconciliation Items</h2>
          {reconciliation.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No items yet. Import a bank statement above, or clear ledger items manually.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Source</th>
                  <th>Cleared</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reconciliation.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.transactionDate?.toLocaleDateString() ??
                        item.transaction?.transactionDate.toLocaleDateString() ??
                        "—"}
                    </td>
                    <td>
                      {item.description ||
                        item.transaction?.description ||
                        item.transaction?.transactionNumber ||
                        "—"}
                    </td>
                    <td>{formatCurrency(toNumber(item.amount))}</td>
                    <td>
                      {item.isManual ? (
                        <span className="badge badge-warning">Bank only</span>
                      ) : (
                        <span className="badge badge-neutral">Ledger</span>
                      )}
                    </td>
                    <td>
                      {item.isCleared ? (
                        <span className="badge badge-success">Cleared</span>
                      ) : (
                        <span className="badge badge-neutral">Pending</span>
                      )}
                    </td>
                    <td>
                      {canEdit && reconciliation.status !== "completed" && (
                        <ReconciliationItemToggle
                          reconciliationId={reconciliation.id}
                          itemId={item.id}
                          isCleared={item.isCleared}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {reconciliation.notes && (
          <div className="card">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Notes</h3>
            <p className="text-sm text-muted-foreground">{reconciliation.notes}</p>
          </div>
        )}
      </main>
    </>
  );
}
