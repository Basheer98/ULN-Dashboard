import { StatusBadge } from "@/components/layout";
import { FinanceHeader } from "@/components/finance/finance-nav";
import { ExpenseForm, ExpenseFilters } from "@/components/finance/finance-forms";
import { prisma } from "@/lib/prisma";
import { formatCurrency, toNumber } from "@uln/shared";
import Link from "next/link";
import type { Prisma } from "@uln/database";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    categoryId?: string;
    fielderId?: string;
    from?: string;
    to?: string;
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
  if (params.from || params.to) {
    where.transactionDate = {};
    if (params.from) where.transactionDate.gte = new Date(params.from);
    if (params.to) where.transactionDate.lte = new Date(params.to);
  }

  const [expenses, categories, fielders, paymentMethods, vendors, projects] = await Promise.all([
    prisma.financialTransaction.findMany({
      where,
      orderBy: { transactionDate: "desc" },
      include: { category: true, vendor: true, fielder: true, project: true },
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

  return (
    <>
      <FinanceHeader title="Expenses" subtitle="Track and approve company expenses" />
      <main className="page-main space-y-6">
        <ExpenseFilters
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          fielders={fielders.map((f) => ({ id: f.id, name: `${f.firstName} ${f.lastName}` }))}
          current={params}
        />

        <ExpenseForm
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            subcategories: c.subcategories,
          }))}
          paymentMethods={paymentMethods.map((pm) => ({ id: pm.id, name: pm.name }))}
          vendors={vendors.map((v) => ({ id: v.id, name: v.name }))}
          projects={projects.map((p) => ({ id: p.id, name: p.projectNumber }))}
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
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td>{exp.transactionDate.toLocaleDateString()}</td>
                    <td>
                      <Link href={`/finance/expenses/${exp.id}`} className="link">
                        {exp.transactionNumber}
                      </Link>
                    </td>
                    <td>{exp.description || "—"}</td>
                    <td>{exp.category?.name || "—"}</td>
                    <td>{exp.vendor?.name || "—"}</td>
                    <td>{formatCurrency(toNumber(exp.amount))}</td>
                    <td>
                      <StatusBadge status={exp.expenseStatus ?? "draft"} />
                    </td>
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
