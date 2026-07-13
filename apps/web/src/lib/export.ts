import { formatCurrency, toNumber, stateName } from "@uln/shared";

export function escapeCsv(value: string | number): string {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export function projectsExportCsv(
  projects: Array<{
    projectNumber: string;
    title: string;
    client: { name: string };
    state: string | null;
    qfield: number | null;
    sqft: unknown;
    clientSqftRate: unknown;
    status: string;
    dueDate: Date | null;
    createdAt: Date;
  }>
): string {
  const header = ["Project #", "Title", "Client", "State", "QField", "SQFT", "Rate/SQFT", "Client Bill", "Status", "ECD", "Created"];
  const rows = projects.map((p) => {
    const sqft = toNumber(p.sqft);
    const rate = toNumber(p.clientSqftRate);
    return [
      p.projectNumber,
      p.title,
      p.client.name,
      stateName(p.state),
      p.qfield ? `QField ${p.qfield}` : "",
      sqft,
      rate,
      sqft * rate,
      p.status,
      p.dueDate ? p.dueDate.toISOString().slice(0, 10) : "",
      p.createdAt.toISOString().slice(0, 10),
    ];
  });
  return toCsv([header, ...rows]);
}

export function paymentsExportCsv(
  payments: Array<{
    fielder: { firstName: string; lastName: string; employmentType: string };
    project: { projectNumber: string } | null;
    totalAmount: unknown;
    status: string;
    paidAt: Date | null;
    createdAt: Date;
  }>
): string {
  const header = ["Fielder", "Type", "Project", "Amount", "Status", "Paid Date", "Created"];
  const rows = payments.map((p) => [
    `${p.fielder.firstName} ${p.fielder.lastName}`,
    p.fielder.employmentType === "w2" ? "W-2" : "1099",
    p.project?.projectNumber ?? "",
    toNumber(p.totalAmount),
    p.status,
    p.paidAt ? p.paidAt.toISOString().slice(0, 10) : "",
    p.createdAt.toISOString().slice(0, 10),
  ]);
  return toCsv([header, ...rows]);
}

export function quickbooksInvoicesCsv(
  invoices: Array<{
    invoiceNumber: string;
    client: { name: string };
    totalAmount: unknown;
    issuedAt: Date | null;
    dueAt: Date | null;
    status: string;
  }>
): string {
  const header = ["*InvoiceNo", "*Customer", "*InvoiceDate", "*DueDate", "*Amount", "Status"];
  const rows = invoices.map((inv) => [
    inv.invoiceNumber,
    inv.client.name,
    (inv.issuedAt ?? new Date()).toISOString().slice(0, 10),
    inv.dueAt ? inv.dueAt.toISOString().slice(0, 10) : "",
    toNumber(inv.totalAmount).toFixed(2),
    inv.status,
  ]);
  return toCsv([header, ...rows]);
}

export function quickbooksPaymentsCsv(
  payments: Array<{
    fielder: { firstName: string; lastName: string; employmentType: string };
    totalAmount: unknown;
    paidAt: Date | null;
    referenceNumber: string | null;
    project: { projectNumber: string } | null;
  }>
): string {
  const header = ["*Vendor", "*BillDate", "*Amount", "RefNumber", "Category", "Project", "Type"];
  const rows = payments.map((p) => [
    `${p.fielder.firstName} ${p.fielder.lastName}`,
    (p.paidAt ?? new Date()).toISOString().slice(0, 10),
    toNumber(p.totalAmount).toFixed(2),
    p.referenceNumber ?? "",
    "Field Services",
    p.project?.projectNumber ?? "",
    p.fielder.employmentType === "w2" ? "W-2" : "1099",
  ]);
  return toCsv([header, ...rows]);
}

export function taxSummaryCsv(
  payments: Array<{
    fielder: { firstName: string; lastName: string; employmentType: string };
    totalAmount: unknown;
  }>
): string {
  const byFielder = new Map<string, { name: string; type: string; total: number }>();
  for (const p of payments) {
    const key = `${p.fielder.firstName} ${p.fielder.lastName}`;
    const entry = byFielder.get(key) ?? {
      name: key,
      type: p.fielder.employmentType === "w2" ? "W-2" : "1099",
      total: 0,
    };
    entry.total += toNumber(p.totalAmount);
    byFielder.set(key, entry);
  }
  const header = ["Fielder", "Employment Type", "Total Paid", "Notes"];
  const rows = Array.from(byFielder.values()).map((e) => [
    e.name,
    e.type,
    e.total.toFixed(2),
    e.type === "1099" ? "Report on 1099-NEC" : "W-2 payroll",
  ]);
  return toCsv([header, ...rows]);
}

export { formatCurrency };
