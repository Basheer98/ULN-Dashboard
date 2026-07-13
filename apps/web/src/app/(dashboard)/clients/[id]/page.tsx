import { Header, StatusBadge } from "@/components/layout";
import { ClientEditForm } from "@/components/client-edit-form";
import { prisma } from "@/lib/prisma";
import { getClientAnalytics } from "@/lib/analytics";
import { formatCurrency, formatRate, toNumber } from "@uln/shared";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: { orderBy: { createdAt: "desc" }, include: { assignments: true } },
      invoices: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!client) notFound();

  const analytics = await getClientAnalytics(id);

  return (
    <>
      <Header title={client.name} subtitle="Client dashboard" />
      <main className="page-main space-y-6">
        <ClientEditForm
          client={{
            id: client.id,
            name: client.name,
            contactName: client.contactName,
            email: client.email,
            phone: client.phone,
            defaultSqftRate: toNumber(client.defaultSqftRate),
            billingTerms: client.billingTerms,
            notes: client.notes,
            isActive: client.isActive,
          }}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Total SQFT</p>
            <p className="mt-2 text-2xl font-semibold">{analytics.totalSqft.toLocaleString()}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Est. Revenue</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(analytics.totalRevenue)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Projects</p>
            <p className="mt-2 text-2xl font-semibold">{analytics.projectCount}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card space-y-3">
            <h2 className="font-semibold text-foreground">Contact</h2>
            <p className="text-sm"><span className="text-muted-foreground">Contact:</span> {client.contactName || "—"}</p>
            <p className="text-sm"><span className="text-muted-foreground">Email:</span> {client.email || "—"}</p>
            <p className="text-sm"><span className="text-muted-foreground">Phone:</span> {client.phone || "—"}</p>
            <p className="text-sm"><span className="text-muted-foreground">Rate:</span> {formatRate(toNumber(client.defaultSqftRate))} / SQFT</p>
            <p className="text-sm"><span className="text-muted-foreground">Terms:</span> {client.billingTerms || "—"}</p>
            {client.notes && <p className="text-sm text-muted-foreground">{client.notes}</p>}
          </div>
          <div className="card">
            <h2 className="mb-4 font-semibold text-foreground">Recent Invoices</h2>
            {client.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {client.invoices.map((inv) => (
                  <li key={inv.id} className="flex justify-between">
                    <span>{inv.invoiceNumber}</span>
                    <span>{formatCurrency(toNumber(inv.totalAmount))}</span>
                    <StatusBadge status={inv.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">All Projects</h2>
            <Link href={`/projects/new?clientId=${client.id}`} className="btn-primary text-sm">
              New Project
            </Link>
          </div>
          {client.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects for this client yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>SQFT</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {client.projects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/projects/${p.id}`} className="link">
                          {p.projectNumber} — {p.title}
                        </Link>
                      </td>
                      <td>{toNumber(p.sqft).toLocaleString()}</td>
                      <td><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
