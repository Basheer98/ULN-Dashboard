import { StatusBadge } from "@/components/layout";
import { FinanceHeader } from "@/components/finance/finance-nav";
import { ExpenseActions } from "@/components/finance/finance-actions";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  findDuplicateExpenses,
  formatCurrency,
  scoreApprovalPriority,
  sortByApprovalPriority,
  toNumber,
} from "@uln/shared";

export default async function ExpenseApprovalsPage() {
  const pending = await prisma.financialTransaction.findMany({
    where: {
      deletedAt: null,
      transactionType: "expense",
      expenseStatus: { in: ["submitted", "pending_review"] },
    },
    include: {
      category: true,
      vendor: true,
      fielder: true,
      project: true,
      receipts: { where: { deletedAt: null } },
    },
    take: 200,
  });

  const existingForDupes = pending.map((row) => ({
    id: row.id,
    transactionNumber: row.transactionNumber,
    amount: toNumber(row.amount),
    transactionDate: row.transactionDate.toISOString(),
    description: row.description,
    fielderId: row.fielderId,
  }));

  const enriched = pending.map((exp) => {
    const isDuplicate =
      findDuplicateExpenses(
        {
          amount: toNumber(exp.amount),
          transactionDate: exp.transactionDate.toISOString(),
          fielderId: exp.fielderId,
        },
        existingForDupes,
        exp.id
      ).length > 0;
    const hasReceipt = exp.receipts.length > 0;
    const receiptPendingVerify = exp.receipts.some((r) => r.verificationStatus === "pending");
    const priority = scoreApprovalPriority({
      id: exp.id,
      amount: toNumber(exp.amount),
      status: exp.expenseStatus,
      createdAt: exp.createdAt.toISOString(),
      hasReceipt,
      isDuplicate,
      receiptPendingVerify,
    });
    return { exp, priority, hasReceipt, isDuplicate, receiptPendingVerify };
  });

  const sorted = sortByApprovalPriority(
    enriched.map((row) => ({
      id: row.exp.id,
      amount: toNumber(row.exp.amount),
      status: row.exp.expenseStatus,
      createdAt: row.exp.createdAt.toISOString(),
      hasReceipt: row.hasReceipt,
      isDuplicate: row.isDuplicate,
      receiptPendingVerify: row.receiptPendingVerify,
      row,
    }))
  );

  return (
    <>
      <FinanceHeader
        title="Expense Approvals"
        subtitle="Sorted by priority — review, duplicates, and missing receipts first"
      />
      <main className="page-main space-y-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/finance/expenses" className="link">
            ← All expenses
          </Link>
          <Link href="/finance/expenses?status=approved&reimburse=1" className="link">
            Batch reimburse →
          </Link>
        </div>

        {sorted.length === 0 ? (
          <div className="card text-center text-sm text-muted-foreground">
            No expenses waiting for approval.
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map(({ row }) => {
              const { exp, priority } = row;
              return (
                <div key={exp.id} className="card space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/finance/expenses/${exp.id}`} className="link font-semibold">
                          {exp.transactionNumber}
                        </Link>
                        <StatusBadge status={exp.expenseStatus ?? "submitted"} />
                      </div>
                      <p className="mt-1 text-sm text-foreground">
                        {exp.description || "No description"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {exp.fielder
                          ? `${exp.fielder.firstName} ${exp.fielder.lastName}`
                          : "Company"}
                        {exp.project ? ` · ${exp.project.projectNumber}` : ""}
                        {exp.category ? ` · ${exp.category.name}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-foreground">
                        {formatCurrency(toNumber(exp.amount))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {exp.transactionDate.toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {priority.reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {priority.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="rounded bg-warning/15 px-2 py-0.5 text-xs text-warning"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  <ExpenseActions expenseId={exp.id} status={exp.expenseStatus} />
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
