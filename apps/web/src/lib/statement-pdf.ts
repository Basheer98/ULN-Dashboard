import { generateReportPdf } from "./pdf";
import { formatCurrency, formatRate } from "@uln/shared";
import type { FielderStatement } from "./statement";

function sqftLabel(l: {
  sqft: number;
  buriedSqft: number | null;
  aerialSqft: number | null;
}) {
  const parts: string[] = [l.sqft.toLocaleString()];
  if (l.buriedSqft != null || l.aerialSqft != null) {
    const bits: string[] = [];
    if (l.buriedSqft != null) bits.push(`B ${l.buriedSqft.toLocaleString()}`);
    if (l.aerialSqft != null) bits.push(`A ${l.aerialSqft.toLocaleString()}`);
    parts.push(`(${bits.join(" / ")})`);
  }
  return parts.join(" ");
}

export function generateStatementPdf(statement: FielderStatement): Buffer {
  const rows = statement.lines.map((l) => [
    l.projectNumber,
    l.state ?? "",
    sqftLabel(l),
    formatRate(l.rate),
    formatCurrency(l.sqftPay),
    formatCurrency(l.extras),
    formatCurrency(l.total),
    formatCurrency(l.amountPaid),
    formatCurrency(l.amountOwed),
    l.paymentStatus,
  ]);

  rows.push([
    "TOTAL",
    "",
    statement.totals.sqft.toLocaleString(),
    "",
    formatCurrency(statement.totals.sqftPay),
    formatCurrency(statement.totals.extras),
    formatCurrency(statement.totals.total),
    formatCurrency(statement.totals.paid),
    formatCurrency(statement.totals.pending),
    "",
  ]);

  const title = `Fielder Statement — ${statement.fielder.firstName} ${statement.fielder.lastName} — ${statement.monthLabel} (${statement.fielder.employmentType === "w2" ? "W-2" : "1099"})`;

  return generateReportPdf(title, rows, [
    "Project",
    "State",
    "SQFT",
    "Rate",
    "SQFT Pay",
    "Extras",
    "Total",
    "Paid",
    "Owed",
    "Status",
  ]);
}
