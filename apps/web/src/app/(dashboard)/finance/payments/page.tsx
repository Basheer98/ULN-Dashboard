import { StatusBadge } from "@/components/layout";
import { FinanceHeader } from "@/components/finance/finance-nav";
import { RecordInvoicePaymentForm } from "@/components/finance/finance-actions";
import { prisma } from "@/lib/prisma";
import { calculateInvoiceBalance, formatCurrency, toNumber } from "@uln/shared";
import Link from "next/link";

export default async function FinancePaymentsPage() {
  const [invoices, paymentMethods, recentPayments] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: { in: ["sent", "partial", "overdue"] } },
      orderBy: { dueAt: "asc" },
      include: {
        client: true,
        project: true,
        invoicePayments: true,
      },
    }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.invoicePayment.findMany({
      orderBy: { paidAt: "desc" },
      take: 20,
      include: {
        invoice: { include: { client: true } },
        transaction: true,
      },
    }),
  ]);

  const outstanding = invoices.map((inv) => {
    const { remaining } = calculateInvoiceBalance(
      toNumber(inv.totalAmount),
      inv.invoicePayments.map((p) => ({ amount: toNumber(p.amount) }))
    );
    return {
      id: inv.id,
      label: `${inv.invoiceNumber} — ${inv.client.name}`,
      remaining,
      inv,
    };
  });

  return (
    <>
      <FinanceHeader title="Invoice Payments" subtitle="Record client payments against outstanding invoices" />
      <main className="page-main space-y-6">
        <RecordInvoicePaymentForm
          invoices={outstanding.map((o) => ({
            id: o.id,
            label: o.label,
            remaining: o.remaining,
          }))}
          paymentMethods={paymentMethods.map((pm) => ({ id: pm.id, name: pm.name }))}
        />

        <section className="card overflow-x-auto">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Outstanding Invoices</h2>
          {outstanding.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outstanding invoices.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Project</th>
                  <th>Total</th>
                  <th>Remaining</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.map(({ inv, remaining }) => (
                  <tr key={inv.id}>
                    <td>
                      <Link href={`/invoices`} className="link">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td>{inv.client.name}</td>
                    <td>
                      <Link href={`/projects/${inv.projectId}`} className="link">
                        {inv.project.projectNumber}
                      </Link>
                    </td>
                    <td>{formatCurrency(toNumber(inv.totalAmount))}</td>
                    <td className="font-medium">{formatCurrency(remaining)}</td>
                    <td className={inv.status === "overdue" ? "text-danger" : ""}>
                      {inv.dueAt ? inv.dueAt.toLocaleDateString() : "—"}
                    </td>
                    <td><StatusBadge status={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card overflow-x-auto">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Payments</h2>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Paid Date</th>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.paidAt.toLocaleDateString()}</td>
                    <td>{p.invoice.invoiceNumber}</td>
                    <td>{p.invoice.client.name}</td>
                    <td>{formatCurrency(toNumber(p.amount))}</td>
                    <td>{p.reference || "—"}</td>
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
