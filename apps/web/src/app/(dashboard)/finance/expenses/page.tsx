import { StatusBadge } from "@/components/layout";
import { FinanceHeader } from "@/components/finance/finance-nav";
import { ExpenseForm, ExpenseFilters } from "@/components/finance/finance-forms";
import { BatchReimbursePanel } from "@/components/finance/receipt-actions";
import { prisma } from "@/lib/prisma";
import {
  findDuplicateExpenses,
  formatCurrency,
  scoreApprovalPriority,
  sortByApprovalPriority,
  stateName,
  toNumber,
} from "@uln/shared";
import Link from "next/link";
import type { Prisma } from "@uln/database";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    categoryId?: string;
    fielderId?: string;
    state?: string;
    from?: string;
    to?: string;
    reimburse?: string;
  }>;
}) {
  const params = await searchParams;
  const where: Prisma.FinancialTransactionWhereInput = {
    deletedAt: null,
    transactionType: "expense",
  };

  if (params.status) {
    where.expenseStatus = params.status as Prisma.EnumExpenseStatusFilter["equals"];
  }
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.fielderId) where.fielderId = params.fielderId;
  if (params.state) {
    const state = params.state.toUpperCase();
    where.OR = [
      { workState: state },
      { AND: [{ workState: null }, { project: { state } }] },
    ];
  }
  if (params.from || params.to) {
    where.transactionDate = {};
    if (params.from) where.transactionDate.gte = new Date(params.from);
    if (params.to) where.transactionDate.lte = new Date(params.to);
  }

  const [expensesRaw, categories, fielders, paymentMethods, vendors, projects] =
    await Promise.all([
      prisma.financialTransaction.findMany({
        where,
        orderBy: { transactionDate: "desc" },
        include: {
          category: true,
          vendor: true,
          fielder: true,
          project: true,
          receipts: { where: { deletedAt: null }, select: { id: true, verificationStatus: true } },
        },
      }),
      prisma.expenseCategory.findMany({
        where: { isActive: true },
        include: { subcategories: { where: { isActive: true } } },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.fielder.findMany({ orderBy: { lastName: "asc" } }),
      prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.vendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.project.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    ]);

  const existingForDupes = expensesRaw.map((row) => ({
    id: row.id,
    transactionNumber: row.transactionNumber,
    amount: toNumber(row.amount),
    transactionDate: row.transactionDate.toISOString(),
    description: row.description,
    fielderId: row.fielderId,
  }));

  const duplicateIds = new Set<string>();
  for (const expense of expensesRaw) {
    const matches = findDuplicateExpenses(
      {
        amount: toNumber(expense.amount),
        transactionDate: expense.transactionDate.toISOString(),
        fielderId: expense.fielderId,
      },
      existingForDupes,
      expense.id
    );
    if (matches.length > 0) duplicateIds.add(expense.id);
  }

  const pendingStatuses = !params.status || ["submitted", "pending_review"].includes(params.status);
  let expenses = expensesRaw;
  if (pendingStatuses) {
    const withPriority = expensesRaw.map((exp) => ({
      ...exp,
      id: exp.id,
      amount: toNumber(exp.amount),
      status: exp.expenseStatus,
      createdAt: exp.createdAt.toISOString(),
      hasReceipt: exp.receipts.length > 0,
      isDuplicate: duplicateIds.has(exp.id),
      receiptPendingVerify: exp.receipts.some((r) => r.verificationStatus === "pending"),
    }));
    const sortedIds = sortByApprovalPriority(withPriority).map((e) => e.id);
    const byId = new Map(expensesRaw.map((e) => [e.id, e]));
    expenses = sortedIds.map((id) => byId.get(id)!).filter(Boolean);
  }

  const batchEligible = expensesRaw
    .filter((e) => e.expenseStatus === "approved" && e.isReimbursable)
    .map((e) => ({
      id: e.id,
      transactionNumber: e.transactionNumber,
      amount: toNumber(e.amount),
      description: e.description,
      fielderName: e.fielder ? `${e.fielder.firstName} ${e.fielder.lastName}` : null,
    }));

  const showBatch = params.reimburse === "1" || params.status === "approved";

  return (
    <>
      <FinanceHeader title="Expenses" subtitle="Track and approve company expenses" />
      <main className="page-main space-y-6">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/finance/expenses/approvals" className="link">
            Priority approvals queue →
          </Link>
          <Link href="/finance/expenses?status=approved&reimburse=1" className="link">
            Batch reimburse →
          </Link>
        </div>

        <ExpenseFilters
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          fielders={fielders.map((f) => ({ id: f.id, name: `${f.firstName} ${f.lastName}` }))}
          current={params}
        />

        {showBatch && <BatchReimbursePanel expenses={batchEligible} />}

        <ExpenseForm
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            subcategories: c.subcategories,
          }))}
          paymentMethods={paymentMethods.map((pm) => ({ id: pm.id, name: pm.name }))}
          vendors={vendors.map((v) => ({ id: v.id, name: v.name }))}
          projects={projects.map((p) => ({
            id: p.id,
            name: p.projectNumber,
            state: p.state,
          }))}
          fielders={fielders.map((f) => ({ id: f.id, name: `${f.firstName} ${f.lastName}` }))}
        />

        {expenses.length === 0 ? (
          <div className="card text-center text-sm text-muted-foreground">
            No expenses match your filters.
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Number</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>State</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Flags</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => {
                  const awaitingApproval =
                    exp.expenseStatus === "submitted" || exp.expenseStatus === "pending_review";
                  const priority = awaitingApproval
                    ? scoreApprovalPriority({
                        id: exp.id,
                        amount: toNumber(exp.amount),
                        status: exp.expenseStatus,
                        createdAt: exp.createdAt.toISOString(),
                        hasReceipt: exp.receipts.length > 0,
                        isDuplicate: duplicateIds.has(exp.id),
                        receiptPendingVerify: exp.receipts.some(
                          (r) => r.verificationStatus === "pending"
                        ),
                      })
                    : null;
                  const showNoReceipt = exp.receipts.length === 0 && awaitingApproval;
                  const showHighAmount = Boolean(priority?.reasons.includes("High amount"));
                  const showReview = exp.expenseStatus === "pending_review";
                  const showDup = duplicateIds.has(exp.id);
                  const showNone = !showDup && !showReview && !showNoReceipt && !showHighAmount;

                  return (
                    <tr key={exp.id}>
                      <td>{exp.transactionDate.toLocaleDateString()}</td>
                      <td>
                        <Link href={`/finance/expenses/${exp.id}`} className="link">
                          {exp.transactionNumber}
                        </Link>
                      </td>
                      <td>{exp.description || "—"}</td>
                      <td>{exp.category?.name || "—"}</td>
                      <td>{stateName(exp.workState || exp.project?.state)}</td>
                      <td>{exp.vendor?.name || "—"}</td>
                      <td>{formatCurrency(toNumber(exp.amount))}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {showDup ? (
                            <span className="rounded bg-warning/15 px-2 py-0.5 text-xs text-warning">
                              Duplicate?
                            </span>
                          ) : null}
                          {showReview ? (
                            <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
                              Review
                            </span>
                          ) : null}
                          {showNoReceipt ? (
                            <span className="rounded bg-danger/15 px-2 py-0.5 text-xs text-danger">
                              No receipt
                            </span>
                          ) : null}
                          {showHighAmount ? (
                            <span className="rounded bg-warning/15 px-2 py-0.5 text-xs text-warning">
                              High $
                            </span>
                          ) : null}
                          {showNone ? <span className="text-muted-foreground">—</span> : null}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={exp.expenseStatus ?? "draft"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
