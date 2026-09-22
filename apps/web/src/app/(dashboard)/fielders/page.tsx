import { Header, StatusBadge } from "@/components/layout";
import { prisma } from "@/lib/prisma";
import { formatRate, toNumber } from "@uln/shared";
import Link from "next/link";

export default async function FieldersPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string }>;
}) {
  const params = await searchParams;
  const showInactive = params.inactive === "1";

  const fielders = await prisma.fielder.findMany({
    where: { isActive: showInactive ? false : true },
    orderBy: { lastName: "asc" },
    include: {
      _count: { select: { assignments: true } },
      user: { select: { email: true } },
    },
  });

  return (
    <>
      <Header
        title={showInactive ? "Inactive Fielders" : "Fielders"}
        subtitle="Manage field workforce and SQFT pay rates"
      />
      <main className="page-main">
        <div className="mb-6 flex flex-wrap justify-end gap-2">
          {showInactive ? (
            <Link href="/fielders" className="btn-secondary">
              Active fielders
            </Link>
          ) : (
            <Link href="/fielders?inactive=1" className="btn-secondary">
              Inactive
            </Link>
          )}
          <Link href="/fielders/new" className="btn-primary">
            Add Fielder
          </Link>
        </div>
        <div className="card overflow-x-auto">
          {fielders.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {showInactive ? "No inactive fielders." : "No fielders yet."}
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Rate / SQFT</th>
                  <th>Region</th>
                  <th>Jobs</th>
                  <th>Mobile Login</th>
                  <th>Status</th>
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
                    <td>{formatRate(toNumber(fielder.defaultSqftRate))}</td>
                    <td>{fielder.region || "—"}</td>
                    <td>{fielder._count.assignments}</td>
                    <td>{fielder.user?.email || "—"}</td>
                    <td>
                      <StatusBadge status={fielder.isActive ? "complete" : "cancelled"} />
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
