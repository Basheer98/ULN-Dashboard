import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonOk, requireOfficeUser } from "@/lib/api";
import { hasPermission, sortByApprovalPriority, toNumber } from "@uln/shared";

export async function GET(request: NextRequest) {
  try {
    const user = requireOfficeUser(await getRequestUser(request));
    const canFinance =
      hasPermission(user.role, "finance:read") ||
      hasPermission(user.role, "finance:admin");
    const canPayments = hasPermission(user.role, "payments:read");

    const [
      activeProjects,
      completedToday,
      pendingExpenses,
      pendingMileage,
      pendingPayments,
      unreadNotifications,
      recentProjects,
    ] = await Promise.all([
      prisma.project.count({
        where: { deletedAt: null, status: { in: ["assigned", "in_progress"] } },
      }),
      prisma.assignment.count({
        where: {
          status: "complete",
          completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      canFinance
        ? prisma.financialTransaction.findMany({
            where: {
              transactionType: "expense",
              expenseStatus: { in: ["submitted", "pending_review"] },
              deletedAt: null,
            },
            orderBy: { createdAt: "desc" },
            include: {
              fielder: true,
              category: true,
              project: true,
              receipts: { where: { deletedAt: null }, select: { id: true, verificationStatus: true } },
            },
            take: 50,
          })
        : Promise.resolve([]),
      canFinance
        ? prisma.mileageEntry.findMany({
            where: { status: { in: ["submitted", "pending_review"] } },
            orderBy: { createdAt: "desc" },
            include: {
              driver: true,
              photos: { where: { deletedAt: null }, select: { id: true, kind: true } },
            },
            take: 20,
          })
        : Promise.resolve([]),
      canPayments
        ? prisma.fielderPayment.findMany({
            where: { status: { in: ["pending", "approved", "partial"] } },
            orderBy: { createdAt: "desc" },
            include: { fielder: true, project: true },
            take: 20,
          })
        : Promise.resolve([]),
      prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
      prisma.project.findMany({
        where: {
          deletedAt: null,
          status: { in: ["assigned", "in_progress", "complete"] },
        },
        orderBy: { updatedAt: "desc" },
        include: {
          client: true,
          assignments: { include: { fielder: true } },
        },
        take: 8,
      }),
    ]);

    const paymentApprovals = pendingPayments
      .filter(
        (payment) =>
          Math.max(0, toNumber(payment.totalAmount) - toNumber(payment.amountPaid)) > 0.001
      )
      .map((payment) => ({
        id: payment.id,
        type: "payment" as const,
        title: payment.project?.projectNumber ?? "Fielder payment",
        subtitle: `${payment.fielder.firstName} ${payment.fielder.lastName}`,
        amount: Math.max(0, toNumber(payment.totalAmount) - toNumber(payment.amountPaid)),
        status: payment.status,
        createdAt: payment.createdAt.toISOString(),
        category: "Payment",
        projectNumber: payment.project?.projectNumber ?? null,
      }));

    return jsonOk({
      capabilities: {
        finance: canFinance,
        payments: canPayments,
      },
      counts: {
        activeProjects,
        completedToday,
        pendingExpenses: pendingExpenses.length,
        pendingMileage: pendingMileage.length,
        pendingPayments: paymentApprovals.length,
        unreadNotifications,
      },
      recentProjects: recentProjects.map((project) => ({
        id: project.id,
        projectNumber: project.projectNumber,
        title: project.title,
        status: project.status,
        clientName: project.client.name,
        dueDate: project.dueDate?.toISOString() ?? null,
        fielders: project.assignments.map(
          (assignment) =>
            `${assignment.fielder.firstName} ${assignment.fielder.lastName}`
        ),
      })),
      approvals: {
        expenses: sortByApprovalPriority(
          pendingExpenses.map((expense) => ({
            id: expense.id,
            type: "expense" as const,
            title: expense.description || expense.transactionNumber,
            subtitle: expense.fielder
              ? `${expense.fielder.firstName} ${expense.fielder.lastName}`
              : "Company expense",
            amount: toNumber(expense.amount),
            status: expense.expenseStatus,
            createdAt: expense.createdAt.toISOString(),
            category: expense.category?.name ?? null,
            projectNumber: expense.project?.projectNumber ?? null,
            hasReceipt: expense.receipts.length > 0,
            receiptPendingVerify: expense.receipts.some((r) => r.verificationStatus === "pending"),
          }))
        ).slice(0, 20),
        mileage: pendingMileage.map((entry) => ({
          id: entry.id,
          type: "mileage" as const,
          title: `${toNumber(entry.totalMiles).toFixed(1)} miles`,
          subtitle: `${entry.driver.firstName} ${entry.driver.lastName}`,
          amount: toNumber(entry.reimbursement),
          status: entry.status,
          createdAt: entry.createdAt.toISOString(),
          category: "Mileage",
          projectNumber: null,
          hasOdometerPhotos:
            entry.photos.some((p) => p.kind === "start_odometer") &&
            entry.photos.some((p) => p.kind === "end_odometer"),
          startOdometer: entry.startOdometer != null ? toNumber(entry.startOdometer) : null,
          endOdometer: entry.endOdometer != null ? toNumber(entry.endOdometer) : null,
        })),
        payments: paymentApprovals,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
