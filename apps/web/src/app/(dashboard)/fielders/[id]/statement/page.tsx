import { Header, StatusBadge } from "@/components/layout";
import { StatementControls } from "@/components/statement-controls";
import { getFielderStatement, type StatementLine } from "@/lib/statement";
import { getSessionUser } from "@/lib/auth";
import { hasPermission, formatCurrency, formatRate, stateName } from "@uln/shared";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

function StatementSection({
  title,
  empty,
  lines,
  totalsHint,
}: {
  title: string;
  empty: string;
  lines: StatementLine[];
  totalsHint?: string;
}) {
  return (
    <div className="card overflow-x-auto">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {title} ({lines.length})
        </h3>
        {totalsHint ? <p className="text-xs text-muted-foreground">{totalsHint}</p> : null}
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
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
              <th>Job</th>
              <th>Pay</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.projectId}>
                <td>
                  <Link href={`/projects/${l.projectId}`} className="link">
                    {l.projectNumber}
                  </Link>
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
                <td>
                  <StatusBadge status={l.assignmentStatus} />
                </td>
                <td className="capitalize text-sm">{l.paymentStatus.replace(/_/g, " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

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

  const { fielder, totals, sections, monthLabel } = statement;
  const canEmail = hasPermission(user.role, "payments:write");

  return (
    <>
      <Header
        title="Fielder Statement"
        subtitle={`${fielder.firstName} ${fielder.lastName} — ${monthLabel}`}
        backHref={`/fielders/${id}`}
        backLabel="Back to fielder"
      />
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
            <p className="text-sm text-muted-foreground">Active / Pending / Paid</p>
            <p className="mt-2 text-2xl font-semibold">
              {totals.activeCount}
              <span className="text-muted-foreground"> / </span>
              {totals.pendingCount}
              <span className="text-muted-foreground"> / </span>
              {totals.paidCount}
            </p>
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

        <StatementSection
          title="Active projects"
          empty="No active assignments for this fielder."
          lines={sections.active}
        />
        <StatementSection
          title={`Pending payment — ${monthLabel}`}
          empty="No pending pay items in this period. Try Last 30 days or All time if work was completed earlier."
          lines={sections.pending}
          totalsHint={`Owed ${formatCurrency(
            sections.pending.reduce((s, l) => s + l.amountOwed, 0)
          )}`}
        />
        <StatementSection
          title={`Paid — ${monthLabel}`}
          empty="No paid projects in this period."
          lines={sections.paid}
          totalsHint={`Paid ${formatCurrency(
            sections.paid.reduce((s, l) => s + l.amountPaid, 0)
          )}`}
        />
      </main>
    </>
  );
}
