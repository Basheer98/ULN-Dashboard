import { Header, StatusBadge } from "@/components/layout";
import { prisma } from "@/lib/prisma";
import { formatRate, toNumber } from "@uln/shared";
import Link from "next/link";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>;
}) {
  const params = await searchParams;
  const showInactive = params.inactive === "1";

  const clients = await prisma.client.findMany({
    where: { isActive: showInactive ? false : true },
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true } } },
  });

  return (
    <>
      <Header
        title={showInactive ? "Inactive Clients" : "Clients"}
        subtitle="Manage client accounts and default SQFT rates"
      />
      <main className="page-main">
        <div className="mb-6 flex flex-wrap justify-end gap-2">
          {showInactive ? (
            <Link href="/clients" className="btn-secondary">
              Active clients
            </Link>
          ) : (
            <Link href="/clients?inactive=1" className="btn-secondary">
              Inactive
            </Link>
          )}
          <Link href="/clients/new" className="btn-primary">
            Add Client
          </Link>
        </div>
        <div className="card overflow-x-auto">
          {clients.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {showInactive ? "No inactive clients." : "No clients yet."}
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Rate / SQFT</th>
                  <th>Projects</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <Link href={`/clients/${client.id}`} className="link">
                        {client.name}
                      </Link>
                    </td>
                    <td>{client.contactName || client.email || "—"}</td>
                    <td>{formatRate(toNumber(client.defaultSqftRate))}</td>
                    <td>{client._count.projects}</td>
                    <td>
                      <StatusBadge status={client.isActive ? "complete" : "cancelled"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
