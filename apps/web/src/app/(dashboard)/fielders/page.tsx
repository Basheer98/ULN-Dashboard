import { Header, StatusBadge } from "@/components/layout";
import { prisma } from "@/lib/prisma";
import { formatCurrency, toNumber } from "@uln/shared";
import Link from "next/link";

export default async function FieldersPage() {
  const fielders = await prisma.fielder.findMany({
    orderBy: { lastName: "asc" },
    include: {
      _count: { select: { assignments: true } },
      user: { select: { email: true } },
    },
  });

  return (
    <>
      <Header title="Fielders" subtitle="Manage field workforce and SQFT pay rates" />
      <main className="page-main">
        <div className="mb-6 flex justify-end">
          <Link href="/fielders/new" className="btn-primary">
            Add Fielder
          </Link>
        </div>
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Rate / SQFT</th>
                <th>Region</th>
                <th>Jobs</th>
                <th>Mobile Login</th>
              </tr>
            </thead>
            <tbody>
              {fielders.map((fielder) => (
                <tr key={fielder.id}>
                  <td>
                    <Link href={`/fielders/${fielder.id}`} className="link">
                      {fielder.firstName} {fielder.lastName}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge status={fielder.employmentType === "w2" ? "assigned" : "in_progress"} />
                    <span className="ml-2 text-xs text-muted-foreground">
                      {fielder.employmentType === "w2" ? "W-2" : "1099"}
                    </span>
                  </td>
                  <td>{formatCurrency(toNumber(fielder.defaultSqftRate))}</td>
                  <td>{fielder.region || "—"}</td>
                  <td>{fielder._count.assignments}</td>
                  <td>{fielder.user?.email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
