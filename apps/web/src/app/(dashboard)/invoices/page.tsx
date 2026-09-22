import { Header } from "@/components/layout";
import { InvoicesFilter } from "@/components/invoices-filter";
import { InvoicesTable, type InvoiceRow } from "@/components/invoices-table";
import { prisma } from "@/lib/prisma";
import { markOverdueInvoices } from "@/lib/finance";
import { toNumber } from "@uln/shared";
import type { Prisma } from "@uln/database";

function dayStart(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d;
}

function dayEnd(iso: string) {
  const d = new Date(`${iso}T23:59:59.999`);
  return d;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await markOverdueInvoices();
  const params = await searchParams;

  const where: Prisma.InvoiceWhereInput = { deletedAt: null };

  if (params.from || params.to) {
    const range: Prisma.DateTimeFilter = {};
    if (params.from) range.gte = dayStart(params.from);
    if (params.to) range.lte = dayEnd(params.to);

    where.AND = [
      {
        OR: [
          { issuedAt: range },
          { issuedAt: null, createdAt: range },
        ],
      },
    ];
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { client: true, project: true },
  });

  const rows: InvoiceRow[] = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    totalAmount: toNumber(inv.totalAmount),
    dueAt: inv.dueAt?.toISOString() ?? null,
    issuedAt: inv.issuedAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
    clientName: inv.client.name,
    projectId: inv.projectId,
    projectNumber: inv.project.projectNumber,
  }));

  return (
    <>
      <Header title="Invoices" subtitle="Client receivables — generate from completed projects" />
      <main className="page-main space-y-4">
        <InvoicesFilter />
        {rows.length === 0 ? (
          <div className="card text-center text-sm text-muted-foreground">
            No invoices match these filters. Mark a project complete and use Generate Invoice on the
            project page.
          </div>
        ) : (
          <InvoicesTable invoices={rows} />
        )}
      </main>
    </>
  );
}
