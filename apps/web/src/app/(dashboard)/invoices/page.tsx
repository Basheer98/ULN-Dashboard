import { Header, StatusBadge } from "@/components/layout";
import { InvoiceActions } from "@/components/finance-actions";
import { prisma } from "@/lib/prisma";
import { markOverdueInvoices } from "@/lib/finance";
import { formatCurrency, toNumber } from "@uln/shared";
import Link from "next/link";

export default async function InvoicesPage() {
  await markOverdueInvoices();
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { client: true, project: true },
  });

  return (
    <>
      <Header title="Invoices" subtitle="Client receivables — generate from completed projects" />
      <main className="page-main">
        {invoices.length === 0 ? (
          <div className="card text-center text-sm text-muted-foreground">
            No invoices yet. Mark a project complete and use Generate Invoice on the project page.
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Project</th>
                  <th>Amount</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoiceNumber}</td>
                    <td>{inv.client.name}</td>
                    <td>
                      <Link href={`/projects/${inv.projectId}`} className="link">
                        {inv.project.projectNumber}
                      </Link>
                    </td>
                    <td>{formatCurrency(toNumber(inv.totalAmount))}</td>
                    <td className={inv.status === "overdue" ? "text-danger" : ""}>
                      {inv.dueAt ? inv.dueAt.toLocaleDateString() : "—"}
                    </td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td><InvoiceActions invoiceId={inv.id} status={inv.status} /></td>
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
