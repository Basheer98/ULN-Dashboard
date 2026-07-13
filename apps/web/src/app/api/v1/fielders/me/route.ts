import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireUser } from "@/lib/api";
import { serializeProject } from "@/lib/projects";
import { getFielderStatement } from "@/lib/statement";
import { buildWeeklyEarnings } from "@/lib/fielder-earnings";
import { toNumber } from "@uln/shared";

export async function GET(request: NextRequest) {
  try {
    const user = requireUser(await getRequestUser(request));
    if (user.role !== "fielder" || !user.fielderId) {
      return jsonError("Forbidden", 403);
    }

    const fielder = await prisma.fielder.findUnique({
      where: { id: user.fielderId },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    });
    if (!fielder) return jsonError("Fielder not found", 404);

    const month = request.nextUrl.searchParams.get("month") ?? undefined;

    const [payments, assignments, expenses, mileageEntries, statement] = await Promise.all([
      prisma.fielderPayment.findMany({
        where: { fielderId: user.fielderId },
        include: { project: { select: { projectNumber: true, title: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.assignment.findMany({
        where: { fielderId: user.fielderId },
        include: { project: { select: { sqft: true, projectNumber: true } } },
      }),
      prisma.financialTransaction.findMany({
        where: {
          fielderId: user.fielderId,
          transactionType: "expense",
          deletedAt: null,
          isReimbursable: true,
        },
      }),
      prisma.mileageEntry.findMany({
        where: { driverId: user.fielderId, isReimbursable: true },
      }),
      getFielderStatement(user.fielderId, month),
    ]);

    const paidTotal = payments
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + toNumber(p.totalAmount), 0);
    const pendingPayTotal = payments
      .filter((p) => p.status !== "paid")
      .reduce((s, p) => s + toNumber(p.totalAmount), 0);

    const activeAssignments = assignments.filter((a) =>
      ["assigned", "accepted", "in_progress"].includes(a.status)
    );
    const estimatedActive = activeAssignments.reduce((s, a) => {
      const sqft = toNumber(a.assignedSqft) || toNumber(a.project.sqft);
      return s + sqft * toNumber(a.fielderSqftRate);
    }, 0);

    const reimbursementPending = expenses.filter((e) =>
      ["submitted", "pending_review", "approved"].includes(e.expenseStatus ?? "")
    );
    const reimbursementPaid = expenses.filter((e) =>
      ["paid", "reimbursed"].includes(e.expenseStatus ?? "")
    );
    const mileagePending = mileageEntries.filter((m) =>
      ["submitted", "pending_review", "approved"].includes(m.status)
    );
    const mileagePaid = mileageEntries.filter((m) =>
      ["paid", "reimbursed"].includes(m.status)
    );

    const pendingReimbursementAmount =
      reimbursementPending.reduce((s, e) => s + toNumber(e.amount), 0) +
      mileagePending.reduce((s, m) => s + toNumber(m.reimbursement), 0);
    const paidReimbursementAmount =
      reimbursementPaid.reduce((s, e) => s + toNumber(e.amount), 0) +
      mileagePaid.reduce((s, m) => s + toNumber(m.reimbursement), 0);

    return jsonOk(
      serializeProject({
        fielder: {
          id: fielder.id,
          firstName: fielder.firstName,
          lastName: fielder.lastName,
          email: fielder.email ?? fielder.user?.email ?? user.email,
          phone: fielder.phone,
          employmentType: fielder.employmentType,
          region: fielder.region,
        },
        earnings: {
          paidTotal,
          pendingPayTotal,
          estimatedActive,
          thisMonth: statement?.totals ?? {
            total: 0,
            paid: 0,
            pending: 0,
            sqft: 0,
            projects: 0,
          },
          monthLabel: statement?.monthLabel ?? "",
          weekly: buildWeeklyEarnings(payments),
        },
        reimbursements: {
          pendingCount: reimbursementPending.length + mileagePending.length,
          pendingAmount: pendingReimbursementAmount,
          paidAmount: paidReimbursementAmount,
          expenseCount: expenses.length,
          mileageCount: mileageEntries.length,
        },
        jobs: {
          active: activeAssignments.length,
          complete: assignments.filter((a) => a.status === "complete").length,
          total: assignments.length,
        },
        recentPayments: payments.slice(0, 10).map((p) => ({
          id: p.id,
          projectNumber: p.project?.projectNumber ?? "—",
          title: p.project?.title ?? "",
          amount: toNumber(p.totalAmount),
          status: p.status,
          paidAt: p.paidAt,
          createdAt: p.createdAt,
        })),
        statement: statement
          ? {
              monthLabel: statement.monthLabel,
              lines: statement.lines,
              totals: statement.totals,
            }
          : null,
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
