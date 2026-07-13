import { StatusBadge } from "@/components/layout";
import { FinanceHeader } from "@/components/finance/finance-nav";
import { LoanForm } from "@/components/finance/finance-forms";
import { LoanPaymentForm } from "@/components/finance/finance-actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency, toNumber } from "@uln/shared";

export default async function LoansPage() {
  const loans = await prisma.loan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      payments: { orderBy: { paidAt: "desc" }, take: 5 },
    },
  });

  return (
    <>
      <FinanceHeader title="Loans" subtitle="Track loans and payment history" />
      <main className="page-main space-y-6">
        <LoanForm />

        {loans.length === 0 ? (
          <div className="card text-center text-sm text-muted-foreground">No loans tracked yet.</div>
        ) : (
          loans.map((loan) => (
            <section key={loan.id} className="card space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{loan.lender}</h2>
                  <p className="text-sm text-muted-foreground">{loan.purpose || "—"}</p>
                </div>
                <StatusBadge status={loan.status} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Original</p>
                  <p className="font-medium">{formatCurrency(toNumber(loan.originalAmount))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className="font-medium">{formatCurrency(toNumber(loan.remainingBalance))}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rate</p>
                  <p className="font-medium">
                    {loan.interestRate ? `${toNumber(loan.interestRate)}%` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Next Payment</p>
                  <p className="font-medium">
                    {loan.nextPaymentDate?.toLocaleDateString() ?? "—"}
                  </p>
                </div>
              </div>

              {loan.status === "active" && (
                <LoanPaymentForm
                  loanId={loan.id}
                  defaultAmount={loan.paymentAmount ? toNumber(loan.paymentAmount) : undefined}
                />
              )}

              {loan.payments.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Principal</th>
                        <th>Interest</th>
                        <th>Total</th>
                        <th>Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loan.payments.map((p) => (
                        <tr key={p.id}>
                          <td>{p.paidAt.toLocaleDateString()}</td>
                          <td>{formatCurrency(toNumber(p.principalAmount))}</td>
                          <td>{formatCurrency(toNumber(p.interestAmount))}</td>
                          <td>{formatCurrency(toNumber(p.totalAmount))}</td>
                          <td>{p.reference || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))
        )}
      </main>
    </>
  );
}
