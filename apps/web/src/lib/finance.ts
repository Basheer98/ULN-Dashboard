import { prisma } from "./prisma";
import { generateInvoiceNumber } from "./api";
import { toNumber } from "@uln/shared";
import { notifyPaymentPending } from "./push";

export async function createInvoiceFromProject(projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: { client: true, lineItems: true, invoices: { where: { deletedAt: null } } },
  });
  if (!project) {
    throw new Error("Project not found");
  }

  if (!["complete", "invoiced", "paid"].includes(project.status)) {
    throw new Error("Project must be complete before generating an invoice");
  }

  const existingDraft = project.invoices.find((i) => !i.deletedAt && i.status === "draft");
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
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      lineItems: true,
      assignments: { include: { fielder: true } },
      payments: true,
    },
  });
  if (!project) {
    throw new Error("Project not found");
  }

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
      deletedAt: null,
      status: { in: ["sent", "partial"] },
      dueAt: { lt: now },
    },
    data: { status: "overdue" },
  });
}

/** Soft-delete invoice. Reverts project to complete when it was only invoiced via this invoice. */
export async function softDeleteInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
  });
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const deleted = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { deletedAt: new Date() },
    include: { client: true, project: true },
  });

  if (invoice.status !== "paid") {
    const remaining = await prisma.invoice.count({
      where: {
        projectId: invoice.projectId,
        deletedAt: null,
        id: { not: invoiceId },
      },
    });
    if (remaining === 0) {
      const project = await prisma.project.findFirst({
        where: { id: invoice.projectId, deletedAt: null },
      });
      if (project?.status === "invoiced") {
        await prisma.project.update({
          where: { id: invoice.projectId },
          data: { status: "complete" },
        });
      }
    }
  }

  return deleted;
}
