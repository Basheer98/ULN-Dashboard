import { Header, StatusBadge } from "@/components/layout";
import { FielderEditForm } from "@/components/fielder-edit-form";
import { prisma } from "@/lib/prisma";
import { getFielderAnalytics } from "@/lib/analytics";
import { formatCurrency, formatRate, toNumber } from "@uln/shared";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function FielderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fielder = await prisma.fielder.findUnique({
    where: { id },
    include: {
      user: true,
      assignments: {
        orderBy: { assignedAt: "desc" },
        include: { project: { include: { client: true } } },
      },
      payments: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!fielder) notFound();

  const analytics = await getFielderAnalytics(id);

  return (
    <>
      <Header title={`${fielder.firstName} ${fielder.lastName}`} subtitle="Fielder dashboard" />
      <main className="page-main space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link href={`/fielders/${id}/statement`} className="btn-primary text-sm">
            Payment statement
          </Link>
          <FielderEditForm
            fielder={{
              id: fielder.id,
              firstName: fielder.firstName,
              lastName: fielder.lastName,
              phone: fielder.phone,
              email: fielder.email,
              employmentType: fielder.employmentType,
              defaultSqftRate: toNumber(fielder.defaultSqftRate),
              region: fielder.region,
              isActive: fielder.isActive,
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Total SQFT</p>
            <p className="mt-2 text-2xl font-semibold">{analytics.totalSqft.toLocaleString()}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Est. Total Pay</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(analytics.totalPay)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Completed Jobs</p>
            <p className="mt-2 text-2xl font-semibold">{analytics.completedJobs}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card space-y-3">
            <h2 className="font-semibold text-foreground">Details</h2>
            <p className="text-sm"><span className="text-muted-foreground">Type:</span> {fielder.employmentType === "w2" ? "W-2" : "1099"}</p>
            <p className="text-sm"><span className="text-muted-foreground">Rate:</span> {formatRate(toNumber(fielder.defaultSqftRate))} / SQFT</p>
            <p className="text-sm"><span className="text-muted-foreground">Phone:</span> {fielder.phone || "—"}</p>
            <p className="text-sm"><span className="text-muted-foreground">Email:</span> {fielder.email || "—"}</p>
            <p className="text-sm"><span className="text-muted-foreground">Region:</span> {fielder.region || "—"}</p>
            <p className="text-sm"><span className="text-muted-foreground">Mobile login:</span> {fielder.user?.email || "Not set up"}</p>
          </div>
          <div className="card">
            <h2 className="mb-4 font-semibold text-foreground">Recent Payments</h2>
            {fielder.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {fielder.payments.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>{formatCurrency(toNumber(p.totalAmount))}</span>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="mb-4 font-semibold text-foreground">All Assignments</h2>
          {fielder.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assignments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Client</th>
                    <th>SQFT</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fielder.assignments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/projects/${a.project.id}`} className="link">
                          {a.project.projectNumber}
                        </Link>
                      </td>
                      <td>{a.project.client.name}</td>
                      <td>{toNumber(a.assignedSqft || a.project.sqft).toLocaleString()}</td>
                      <td><StatusBadge status={a.status} /></td>
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
