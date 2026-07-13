import { prisma } from "./prisma";
import { generateInvoiceNumber } from "./api";
import { toNumber } from "@uln/shared";
import { notifyPaymentPending } from "./push";

export async function createInvoiceFromProject(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { client: true, lineItems: true, invoices: true },
  });

  if (!["complete", "invoiced", "paid"].includes(project.status)) {
    throw new Error("Project must be complete before generating an invoice");
  }

  const existingDraft = project.invoices.find((i) => i.status === "draft");
  if (existingDraft) return existingDraft;

  const sqft = toNumber(project.sqft);
  const rate = toNumber(project.clientSqftRate);
  const sqftAmount = sqft * rate;
  const lineItemsTotal = project.lineItems
    .filter((l) => l.type === "client_billing")
    .reduce((s, l) => s + toNumber(l.amount), 0);
  const totalAmount = sqftAmount + lineItemsTotal;

  const invoiceNumber = await generateInvoiceNumber();
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 30);

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      projectId,
      clientId: project.clientId,
      sqftAmount,
      lineItemsTotal,
      totalAmount,
      status: "draft",
      dueAt,
    },
    include: { client: true, project: true },
  });

  if (project.status === "complete") {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "invoiced" },
    });
  }

  return invoice;
}

export async function createPaymentsFromProject(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      lineItems: true,
      assignments: { include: { fielder: true } },
      payments: true,
    },
  });

  const created = [];

  for (const assignment of project.assignments) {
    const existing = project.payments.find(
      (p) => p.fielderId === assignment.fielderId && p.projectId === projectId
    );
    if (existing) continue;

    const sqft = toNumber(assignment.assignedSqft) || toNumber(project.sqft);
    const rate = toNumber(assignment.fielderSqftRate);
    const sqftAmount = sqft * rate;
    const lineItemsTotal = project.lineItems
      .filter(
        (l) =>
          l.type === "fielder_payout" &&
          (l.fielderId === assignment.fielderId || !l.fielderId)
      )
      .reduce((s, l) => s + toNumber(l.amount), 0);

    const payment = await prisma.fielderPayment.create({
      data: {
        fielderId: assignment.fielderId,
        projectId,
        sqftAmount,
        lineItemsTotal,
        totalAmount: sqftAmount + lineItemsTotal,
        employmentType: assignment.fielder.employmentType,
        status: "pending",
      },
      include: { fielder: true, project: true },
    });
    created.push(payment);

    await notifyPaymentPending(
      assignment.fielderId,
      project.projectNumber,
      toNumber(payment.totalAmount)
    );
  }

  return created;
}

export async function markOverdueInvoices() {
  const now = new Date();
  await prisma.invoice.updateMany({
    where: {
      status: { in: ["sent", "partial"] },
      dueAt: { lt: now },
    },
    data: { status: "overdue" },
  });
}
