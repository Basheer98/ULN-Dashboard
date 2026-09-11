import { Header } from "@/components/layout";
import { PaymentsBoard, type PaymentRow } from "@/components/payments-board";
import { prisma } from "@/lib/prisma";
import { formatCurrency, toNumber } from "@uln/shared";
import type { Prisma } from "@uln/database";
import { Suspense } from "react";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    fielderId?: string;
    status?: string;
    from?: string;
    to?: string;
    employmentType?: string;
    year?: string;
  }>;
}) {
  const params = await searchParams;

  const where: Prisma.FielderPaymentWhereInput = {};
  if (params.fielderId) where.fielderId = params.fielderId;
  if (params.status) where.status = params.status as Prisma.EnumPaymentStatusFilter["equals"];
  if (params.employmentType === "contractor_1099" || params.employmentType === "w2") {
    where.employmentType = params.employmentType;
  }
  if (params.year) {
    const y = Number(params.year);
    if (Number.isFinite(y)) {
      where.OR = [
        { paidAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } },
        {
          AND: [
            { paidAt: null },
            { createdAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } },
          ],
        },
      ];
    }
  } else if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) where.createdAt.gte = new Date(params.from);
    if (params.to) where.createdAt.lte = new Date(params.to);
  }

  const [payments, fielders] = await Promise.all([
    prisma.fielderPayment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        fielder: true,
        project: { include: { assignments: true } },
      },
    }),
    prisma.fielder.findMany({
      where: { isActive: true },
      orderBy: { lastName: "asc" },
    }),
  ]);

  const contractorTotal = payments
    .filter((p) => p.employmentType === "contractor_1099")
    .reduce((s, p) => s + toNumber(p.amountPaid), 0);
  const w2Total = payments
    .filter((p) => p.employmentType === "w2")
    .reduce((s, p) => s + toNumber(p.amountPaid), 0);

  const rows: PaymentRow[] = payments.map((p) => {
    const assignment = p.project?.assignments.find((a) => a.fielderId === p.fielderId);
    return {
      id: p.id,
      status: p.status,
      employmentType: p.employmentType,
      totalAmount: toNumber(p.totalAmount),
      amountPaid: toNumber(p.amountPaid),
      sqftAmount: toNumber(p.sqftAmount),
      lineItemsTotal: toNumber(p.lineItemsTotal),
      paidAt: p.paidAt?.toISOString() ?? null,
      referenceNumber: p.referenceNumber,
      createdAt: p.createdAt.toISOString(),
      fielderId: p.fielderId,
      fielderName: `${p.fielder.firstName} ${p.fielder.lastName}`,
      projectId: p.projectId,
      projectNumber: p.project?.projectNumber ?? null,
      sqft: assignment
        ? toNumber(assignment.assignedSqft) || toNumber(p.project?.sqft)
        : null,
      rate: assignment ? toNumber(assignment.fielderSqftRate) : null,
    };
  });

  return (
    <>
      <Header title="Payments" subtitle="Fielder payables — filter, batch pay, export for 1099" />
      <main className="page-main space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">1099 Amount Paid (filtered)</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(contractorTotal)}</p>
          </div>
          <div className="stat-card">
            <p className="text-sm text-muted-foreground">W-2 Amount Paid (filtered)</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(w2Total)}</p>
          </div>
        </div>

        <Suspense fallback={<div className="card text-sm text-muted-foreground">Loading…</div>}>
          <PaymentsBoard
            payments={rows}
            fielders={fielders.map((f) => ({
              id: f.id,
              name: `${f.firstName} ${f.lastName}`,
            }))}
            initialFilters={{
              fielderId: params.fielderId ?? "",
              status: params.status ?? "",
              from: params.from ?? "",
              to: params.to ?? "",
              employmentType: params.employmentType ?? "",
              year: params.year ?? "",
            }}
          />
        </Suspense>
      </main>
    </>
  );
}
