import { StatusBadge } from "@/components/layout";
import { FinanceHeader } from "@/components/finance/finance-nav";
import { ExpenseActions } from "@/components/finance/finance-actions";
import { prisma } from "@/lib/prisma";
import { transactionInclude } from "@/lib/finance-transactions";
import { formatCurrency, formatStatus, toNumber } from "@uln/shared";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const expense = await prisma.financialTransaction.findFirst({
    where: { id, transactionType: "expense", deletedAt: null },
    include: transactionInclude,
  });

  if (!expense) notFound();

  return (
    <>
      <FinanceHeader title="Expense Detail" subtitle={expense.transactionNumber} />
      <main className="page-main space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/finance/expenses" className="link text-sm">
            ← Back to expenses
          </Link>
          <ExpenseActions expenseId={expense.id} status={expense.expenseStatus} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card space-y-3">
            <h2 className="font-semibold text-foreground">Details</h2>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-medium">{formatCurrency(toNumber(expense.amount))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Date</dt>
                <dd>{expense.transactionDate.toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd><StatusBadge status={expense.expenseStatus ?? "draft"} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Category</dt>
                <dd>{expense.category?.name || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Vendor</dt>
                <dd>{expense.vendor?.name || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Payment Method</dt>
                <dd>{expense.paymentMethod?.name || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Paid By</dt>
                <dd>{expense.paidBy ? formatStatus(expense.paidBy) : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Reimbursable</dt>
                <dd>{expense.isReimbursable ? "Yes" : "No"}</dd>
              </div>
            </dl>
          </div>

          <div className="card space-y-3">
            <h2 className="font-semibold text-foreground">Context</h2>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Project</dt>
                <dd>
                  {expense.project ? (
                    <Link href={`/projects/${expense.projectId}`} className="link">
                      {expense.project.projectNumber}
                    </Link>
                  ) : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Fielder</dt>
                <dd>
                  {expense.fielder
                    ? `${expense.fielder.firstName} ${expense.fielder.lastName}`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Description</dt>
                <dd className="text-right">{expense.description || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Business Purpose</dt>
                <dd className="text-right">{expense.businessPurpose || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="text-right">{expense.notes || "—"}</dd>
              </div>
              {expense.reviewReason && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Review Reason</dt>
                  <dd className="text-right text-danger">{expense.reviewReason}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {expense.receipts.length > 0 && (
          <div className="card overflow-x-auto">
            <h2 className="mb-4 font-semibold text-foreground">Receipts</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {expense.receipts.map((r) => (
                  <tr key={r.id}>
                    <td>{r.originalFileName}</td>
                    <td><StatusBadge status={r.verificationStatus} /></td>
                    <td>{r.createdAt.toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {expense.allocations.length > 0 && (
          <div className="card overflow-x-auto">
            <h2 className="mb-4 font-semibold text-foreground">Project Allocations</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expense.allocations.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/projects/${a.projectId}`} className="link">
                        {a.project.projectNumber}
                      </Link>
                    </td>
                    <td>{formatCurrency(toNumber(a.amount))}</td>
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
