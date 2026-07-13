import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency, toNumber } from "@uln/shared";

interface InvoicePdfData {
  invoiceNumber: string;
  client: { name: string; contactName?: string | null; email?: string | null };
  project: { projectNumber: string; title: string; sqft: unknown; clientSqftRate: unknown };
  sqftAmount: unknown;
  lineItemsTotal: unknown;
  totalAmount: unknown;
  issuedAt: Date | null;
  dueAt: Date | null;
  lineItems?: { description: string; amount: unknown }[];
}

export function generateInvoicePdf(data: InvoicePdfData): Buffer {
  const doc = new jsPDF();
  const sqft = toNumber(data.project.sqft);
  const rate = toNumber(data.project.clientSqftRate);

  doc.setFontSize(18);
  doc.text("Urbanlink Networks LLC", 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("INVOICE", 14, 28);
  doc.setTextColor(0);

  doc.setFontSize(10);
  doc.text(`Invoice #: ${data.invoiceNumber}`, 140, 20);
  doc.text(`Date: ${(data.issuedAt ?? new Date()).toLocaleDateString()}`, 140, 26);
  if (data.dueAt) doc.text(`Due: ${data.dueAt.toLocaleDateString()}`, 140, 32);

  doc.text("Bill To:", 14, 44);
  doc.setFontSize(11);
  doc.text(data.client.name, 14, 50);
  doc.setFontSize(10);
  if (data.client.contactName) doc.text(data.client.contactName, 14, 56);
  if (data.client.email) doc.text(data.client.email, 14, 62);

  doc.text(`Project: ${data.project.projectNumber} — ${data.project.title}`, 14, 74);

  const rows: string[][] = [
    ["SQFT Services", `${sqft.toLocaleString()} SQFT @ ${formatCurrency(rate)}/SQFT`, formatCurrency(toNumber(data.sqftAmount))],
  ];

  if (data.lineItems?.length) {
    for (const item of data.lineItems) {
      rows.push([item.description, "", formatCurrency(toNumber(item.amount))]);
    }
  } else if (toNumber(data.lineItemsTotal) > 0) {
    rows.push(["Additional charges", "", formatCurrency(toNumber(data.lineItemsTotal))]);
  }

  autoTable(doc, {
    startY: 82,
    head: [["Description", "Details", "Amount"]],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [4, 47, 46] },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;
  doc.setFontSize(12);
  doc.text(`Total: ${formatCurrency(toNumber(data.totalAmount))}`, 140, finalY + 12);

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Thank you for your business.", 14, 280);

  return Buffer.from(doc.output("arraybuffer"));
}

export function generateReportPdf(title: string, rows: string[][], headers: string[]): Buffer {
  const doc = new jsPDF({ orientation: rows.length > 8 ? "landscape" : "portrait" });
  doc.setFontSize(16);
  doc.text("Urbanlink Networks LLC", 14, 16);
  doc.setFontSize(12);
  doc.text(title, 14, 24);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

  autoTable(doc, {
    startY: 36,
    head: [headers],
    body: rows,
    theme: "striped",
    headStyles: { fillColor: [4, 47, 46] },
    styles: { fontSize: 8 },
  });

  return Buffer.from(doc.output("arraybuffer"));
}
