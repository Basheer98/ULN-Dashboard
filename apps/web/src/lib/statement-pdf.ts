import { generateReportPdf } from "./pdf";
import { formatCurrency, formatRate } from "@uln/shared";
import type { FielderStatement } from "./statement";

export function generateStatementPdf(statement: FielderStatement): Buffer {
  const rows = statement.lines.map((l) => [
    l.projectNumber,
    l.state ?? "",
    l.sqft.toLocaleString(),
    formatRate(l.rate),
    formatCurrency(l.sqftPay),
    formatCurrency(l.extras),
    formatCurrency(l.total),
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
    "Status",
  ]);
}
