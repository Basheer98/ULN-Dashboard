import { StatusBadge } from "@/components/layout";
import { FinanceHeader } from "@/components/finance/finance-nav";
import { MileageActions } from "@/components/finance/finance-actions";
import { prisma } from "@/lib/prisma";
import { formatCurrency, toNumber } from "@uln/shared";
import Link from "next/link";

export default async function MileagePage() {
  const entries = await prisma.mileageEntry.findMany({
    orderBy: { date: "desc" },
    include: {
      driver: true,
      vehicle: true,
      trip: true,
    },
  });

  return (
    <>
      <FinanceHeader title="Mileage" subtitle="Review, approve, and reimburse mileage" />
      <main className="page-main">
        {entries.length === 0 ? (
          <div className="card text-center text-sm text-muted-foreground">
            No mileage entries yet.
          </div>
        ) : (
          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Driver</th>
                  <th>Route</th>
                  <th>Miles</th>
                  <th>Reimbursement</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((m) => (
                  <tr key={m.id}>
                    <td>{m.date.toLocaleDateString()}</td>
                    <td>
                      <Link href={`/fielders/${m.driverId}`} className="link">
                        {m.driver.firstName} {m.driver.lastName}
                      </Link>
                    </td>
                    <td>
                      {[m.startLocation, m.destination].filter(Boolean).join(" → ") || "—"}
                      {m.trip && (
                        <p className="text-xs text-muted-foreground">Trip: {m.trip.name}</p>
                      )}
                    </td>
                    <td>{toNumber(m.totalMiles).toFixed(1)}</td>
                    <td>{formatCurrency(toNumber(m.reimbursement))}</td>
                    <td><StatusBadge status={m.status} /></td>
                    <td>
                      <MileageActions mileageId={m.id} status={m.status} />
                    </td>
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
