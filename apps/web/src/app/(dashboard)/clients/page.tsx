import { Header, StatusBadge } from "@/components/layout";
import { prisma } from "@/lib/prisma";
import { formatCurrency, toNumber } from "@uln/shared";
import Link from "next/link";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true } } },
  });

  return (
    <>
      <Header title="Clients" subtitle="Manage client accounts and default SQFT rates" />
      <main className="page-main">
        <div className="mb-6 flex justify-end">
          <Link href="/clients/new" className="btn-primary">
            Add Client
          </Link>
        </div>
        <div className="card overflow-x-auto">
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
                  <td>{formatCurrency(toNumber(client.defaultSqftRate))}</td>
                  <td>{client._count.projects}</td>
                  <td>
                    <StatusBadge status={client.isActive ? "complete" : "cancelled"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
