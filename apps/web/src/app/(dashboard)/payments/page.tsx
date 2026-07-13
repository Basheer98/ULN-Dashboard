import { Header, StatusBadge } from "@/components/layout";
import { PaymentActions } from "@/components/payment-actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency, toNumber } from "@uln/shared";
import Link from "next/link";

export default async function PaymentsPage() {
  const payments = await prisma.fielderPayment.findMany({
    orderBy: { createdAt: "desc" },
    include: { fielder: true, project: true },
  });

  const contractorTotal = payments
    .filter((p) => p.employmentType === "contractor_1099" && p.status === "paid")
    .reduce((s, p) => s + toNumber(p.totalAmount), 0);
  const w2Total = payments
    .filter((p) => p.employmentType === "w2" && p.status === "paid")
    .reduce((s, p) => s + toNumber(p.totalAmount), 0);

  return (
    <>
      <Header title="Payments" subtitle="Fielder payables — 1099 and W-2 breakdown" />
      <main className="page-main space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">1099 Paid (YTD tracked)</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(contractorTotal)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">W-2 Paid (YTD tracked)</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(w2Total)}</p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="card text-center text-sm text-muted-foreground">
            No payments yet. Generate payments from a completed project on the project page.
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fielder</th>
                  <th>Type</th>
                  <th>Project</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/fielders/${p.fielderId}`} className="link">
                        {p.fielder.firstName} {p.fielder.lastName}
                      </Link>
                    </td>
                    <td>{p.employmentType === "w2" ? "W-2" : "1099"}</td>
                    <td>
                      {p.project ? (
                        <Link href={`/projects/${p.projectId}`} className="link">
                          {p.project.projectNumber}
                        </Link>
                      ) : "—"}
                    </td>
                    <td>{formatCurrency(toNumber(p.totalAmount))}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td><PaymentActions paymentId={p.id} status={p.status} /></td>
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
