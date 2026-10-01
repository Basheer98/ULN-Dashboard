import Link from "next/link";
import { formatCurrency, hasPermission } from "@uln/shared";
import { FinanceHeader } from "@/components/finance/finance-nav";
import { OperatingCostsManager } from "@/components/finance/operating-costs";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  OPERATIONS_PERIOD_OPTIONS,
  getOperationsCostReport,
  parseMonthKey,
  parsePeriodMonths,
  type CostLine,
} from "@/lib/operations-cost";

function formatPerSqft(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toFixed(value !== 0 && Math.abs(value) < 1 ? 4 : 2)}`;
}

function formatSqft(value: number): string {
  return Math.round(value).toLocaleString();
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="stat-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : ""
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CostTable({
  title,
  description,
  lines,
  total,
  sqft,
}: {
  title: string;
  description: string;
  lines: CostLine[];
  total: number;
  sqft: number;
}) {
  return (
    <section className="card">
      <h2 className="font-semibold text-foreground">{title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing in this period.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Cost</th>
              <th>Amount</th>
              <th>Per SQFT</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.key}>
                <td>
                  <p>{line.label}</p>
                  {line.detail && <p className="text-xs text-muted-foreground">{line.detail}</p>}
                  {line.estimated > 0 && (
                    <p className="text-xs text-warning">
                      {line.recorded > 0
                        ? `${formatCurrency(line.estimated)} estimated, ${formatCurrency(line.recorded)} recorded`
                        : "Estimated from recurring cost"}
                    </p>
                  )}
                </td>
                <td>{formatCurrency(line.amount)}</td>
                <td>{formatPerSqft(sqft > 0 ? line.amount / sqft : null)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td>Total</td>
              <td>{formatCurrency(total)}</td>
              <td>{formatPerSqft(sqft > 0 ? total / sqft : null)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

export default async function OperationsCostPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; months?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthKey(params.month);
  const months = parsePeriodMonths(params.months);

  const [user, report, categories] = await Promise.all([
    getSessionUser(),
    getOperationsCostReport(month, months),
    prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  const canEdit =
    !!user && (hasPermission(user.role, "finance:write") || hasPermission(user.role, "finance:admin"));

  const { summary } = report;
  const periodLabel =
    months === 1
      ? report.from.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
      : `${report.from.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })} – ${report.to.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`;
  const perMonth = months > 1 ? " / month avg" : "";
  const breakEvenGap =
    summary.breakEvenSqftPerMonth != null ? summary.sqftPerMonth - summary.breakEvenSqftPerMonth : null;

  return (
    <>
      <FinanceHeader
        title="Operations Cost"
        subtitle="What it costs to run the business, cost per SQFT, and the SQFT needed to break even"
      />
      <main className="page-main space-y-6">
        <form method="get" className="card flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Ending month</label>
            <input type="month" name="month" defaultValue={month} />
          </div>
          <div>
            <label className="label">Period</label>
            <select name="months" defaultValue={String(months)}>
              {OPERATIONS_PERIOD_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "1 month" : `Last ${n} months`}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Update
          </button>
          <p className="text-sm text-muted-foreground sm:ml-auto">Showing {periodLabel}</p>
        </form>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={`Operating cost${perMonth}`}
            value={formatCurrency(summary.monthlyTotal)}
            hint={`Fixed ${formatCurrency(summary.monthlyFixed)} + variable ${formatCurrency(
              summary.variableCosts / months
            )}`}
          />
          <StatCard
            label="Cost per SQFT"
            value={formatPerSqft(summary.costPerSqft)}
            hint={
              summary.revenuePerSqft != null
                ? `Billing ${formatPerSqft(summary.revenuePerSqft)} per SQFT`
                : "No completed SQFT in this period"
            }
          />
          <StatCard
            label={`Break-even SQFT${months > 1 ? " / month" : ""}`}
            value={summary.breakEvenSqftPerMonth != null ? formatSqft(summary.breakEvenSqftPerMonth) : "—"}
            hint={
              breakEvenGap != null
                ? `Completed ${formatSqft(summary.sqftPerMonth)} · ${
                    breakEvenGap >= 0
                      ? `${formatSqft(breakEvenGap)} above`
                      : `${formatSqft(-breakEvenGap)} short`
                  }`
                : summary.contributionPerSqft != null
                  ? "Variable costs exceed billing per SQFT"
                  : "Needs completed SQFT to calculate"
            }
            tone={breakEvenGap == null ? undefined : breakEvenGap >= 0 ? "success" : "danger"}
          />
          <StatCard
            label="Net profit"
            value={formatCurrency(summary.netProfit)}
            hint={`${summary.margin}% margin on ${formatCurrency(report.revenue)} billed`}
            tone={summary.netProfit >= 0 ? "success" : "danger"}
          />
        </div>

        <section className="card">
          <h2 className="mb-4 font-semibold text-foreground">Per SQFT Breakdown</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <p className="text-xs text-muted-foreground">Billing</p>
              <p className="font-medium">{formatPerSqft(summary.revenuePerSqft)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fielder pay</p>
              <p className="font-medium">{formatPerSqft(summary.fielderPayPerSqft)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Other variable</p>
              <p className="font-medium">{formatPerSqft(summary.otherVariablePerSqft)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overhead</p>
              <p className="font-medium">{formatPerSqft(summary.overheadPerSqft)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contribution to overhead</p>
              <p className="font-medium">{formatPerSqft(summary.contributionPerSqft)}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            SQFT completed: {formatSqft(report.sqftCompleted)} across {report.projectRows.length} project
            {report.projectRows.length === 1 ? "" : "s"}. Break-even SQFT = monthly fixed costs ÷ (billing −
            fielder pay − other variable costs per SQFT).
            {report.loanPrincipal > 0 &&
              ` Loan principal of ${formatCurrency(report.loanPrincipal)} was paid in this period; it reduces debt and is not counted as an operating cost.`}
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <CostTable
            title="Fixed Costs (Overhead)"
            description="Recurring costs and loan interest. Spread across projects by SQFT."
            lines={report.fixedLines}
            total={report.fixedCosts}
            sqft={report.sqftCompleted}
          />
          <CostTable
            title="Variable Costs"
            description="Fielder pay for completed work, recorded expenses, and mileage reimbursements."
            lines={report.variableLines}
            total={summary.variableCosts}
            sqft={report.sqftCompleted}
          />
        </div>

        <section className="card">
          <h2 className="font-semibold text-foreground">Projects Completed — Overhead by SQFT</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Each project carries overhead and other variable costs in proportion to its SQFT.
          </p>
          {report.projectRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects completed in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Client</th>
                    <th>Completed</th>
                    <th>SQFT</th>
                    <th>Billed</th>
                    <th>Fielder pay</th>
                    <th>Other variable</th>
                    <th>Overhead</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {report.projectRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/projects/${row.id}`} className="link">
                          {row.projectNumber}
                        </Link>
                      </td>
                      <td>{row.clientName}</td>
                      <td>{row.completedAt.toLocaleDateString("en-US", { timeZone: "UTC" })}</td>
                      <td>{formatSqft(row.sqft)}</td>
                      <td>{formatCurrency(row.revenue)}</td>
                      <td>{formatCurrency(row.fielderPay)}</td>
                      <td>{formatCurrency(row.otherVariableShare)}</td>
                      <td>{formatCurrency(row.overheadShare)}</td>
                      <td className={row.net >= 0 ? "text-success" : "text-danger"}>
                        {formatCurrency(row.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <OperatingCostsManager
          costs={report.recurringCosts}
          categories={categories}
          currentMonthlyFixed={report.currentMonthlyFixed}
          canEdit={canEdit}
        />
      </main>
    </>
  );
}
