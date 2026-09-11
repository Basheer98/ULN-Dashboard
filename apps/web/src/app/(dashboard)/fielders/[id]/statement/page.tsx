import { Header } from "@/components/layout";
import { StatementControls } from "@/components/statement-controls";
import { getFielderStatement } from "@/lib/statement";
import { getSessionUser } from "@/lib/auth";
import { hasPermission, formatCurrency, formatRate, stateName } from "@uln/shared";
import { notFound, redirect } from "next/navigation";

export default async function FielderStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; from?: string; to?: string }>;
}) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "payments:read")) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const sp = await searchParams;
  const now = new Date();
  const monthValue =
    sp.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const range =
    sp.from && sp.to
      ? { from: sp.from, to: sp.to }
      : monthValue;

  const statement = await getFielderStatement(id, range);
  if (!statement) notFound();

  const { fielder, totals, lines, monthLabel } = statement;
  const canEmail = hasPermission(user.role, "payments:write");

  return (
    <>
      <Header title="Fielder Statement" subtitle={`${fielder.firstName} ${fielder.lastName} — ${monthLabel}`} />
      <main className="page-main space-y-6">
        <StatementControls
          fielderId={id}
          month={monthValue}
          from={sp.from}
          to={sp.to}
          canEmail={canEmail}
        />

        <div className="card space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {fielder.firstName} {fielder.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">
                {fielder.employmentType === "w2" ? "W-2 Employee" : "1099 Contractor"}
                {fielder.email ? ` · ${fielder.email}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-accent">Urbanlink Networks LLC</p>
              <p className="text-sm text-muted-foreground">{monthLabel}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Projects Completed</p>
            <p className="mt-2 text-2xl font-semibold">{totals.projects}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Total SQFT</p>
            <p className="mt-2 text-2xl font-semibold">{totals.sqft.toLocaleString()}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Total Earned</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(totals.total)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">Paid / Remaining</p>
            <p className="mt-2 text-lg font-semibold">
              <span className="text-success">{formatCurrency(totals.paid)}</span>
              {" / "}
              <span className="text-warning">{formatCurrency(totals.pending)}</span>
            </p>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            Completed projects — {monthLabel}
          </h3>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects completed in this period.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>State</th>
                  <th>SQFT</th>
                  <th>Rate</th>
                  <th>SQFT Pay</th>
                  <th>Extras</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Owed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.projectNumber}>
                    <td>
                      {l.projectNumber}
                      <p className="text-xs text-muted-foreground">{l.title}</p>
                    </td>
                    <td>{stateName(l.state)}</td>
                    <td>
                      {l.sqft.toLocaleString()}
                      {(l.buriedSqft != null || l.aerialSqft != null) && (
                        <p className="text-xs text-muted-foreground">
                          {l.buriedSqft != null ? `Buried ${l.buriedSqft.toLocaleString()}` : null}
                          {l.buriedSqft != null && l.aerialSqft != null ? " · " : null}
                          {l.aerialSqft != null ? `Aerial ${l.aerialSqft.toLocaleString()}` : null}
                        </p>
                      )}
                    </td>
                    <td>{formatRate(l.rate)}</td>
                    <td>{formatCurrency(l.sqftPay)}</td>
                    <td>{formatCurrency(l.extras)}</td>
                    <td className="font-medium">{formatCurrency(l.total)}</td>
                    <td>{formatCurrency(l.amountPaid)}</td>
                    <td className={l.amountOwed > 0 ? "text-warning" : "text-success"}>
                      {formatCurrency(l.amountOwed)}
                    </td>
                    <td className="capitalize">{l.paymentStatus}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td>TOTAL</td>
                  <td></td>
                  <td>{totals.sqft.toLocaleString()}</td>
                  <td></td>
                  <td>{formatCurrency(totals.sqftPay)}</td>
                  <td>{formatCurrency(totals.extras)}</td>
                  <td className="text-accent">{formatCurrency(totals.total)}</td>
                  <td>{formatCurrency(totals.paid)}</td>
                  <td>{formatCurrency(totals.pending)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
