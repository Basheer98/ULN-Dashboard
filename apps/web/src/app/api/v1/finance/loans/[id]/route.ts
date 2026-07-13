import { NextRequest } from "next/server";
import { z } from "zod";
import { loanSchema, loanPaymentSchema, toNumber } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead, requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { generateTransactionNumber } from "@/lib/finance-transactions";

function serializeLoan(loan: {
  originalAmount: unknown;
  remainingBalance: unknown;
  interestRate: unknown;
  paymentAmount: unknown;
  [key: string]: unknown;
}) {
  return {
    ...loan,
    originalAmount: toNumber(loan.originalAmount),
    remainingBalance: toNumber(loan.remainingBalance),
    interestRate: loan.interestRate != null ? toNumber(loan.interestRate) : null,
    paymentAmount: loan.paymentAmount != null ? toNumber(loan.paymentAmount) : null,
  };
}

const loanUpdateSchema = loanSchema.partial().extend({
  status: z.enum(["active", "paid_off", "defaulted", "cancelled"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const { id } = await params;

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { payments: { orderBy: { paidAt: "desc" } } },
    });
    if (!loan) return jsonError("Loan not found", 404);

    return jsonOk(serializeLoan(loan));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;
    const body = await request.json();
    const parsed = loanUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const existing = await prisma.loan.findUnique({ where: { id } });
    if (!existing) return jsonError("Loan not found", 404);

    const loan = await prisma.loan.update({
      where: { id },
      data: {
        ...(parsed.data.lender !== undefined ? { lender: parsed.data.lender } : {}),
        ...(parsed.data.interestRate !== undefined
          ? { interestRate: parsed.data.interestRate }
          : {}),
        ...(parsed.data.startDate !== undefined
          ? {
              startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
            }
          : {}),
        ...(parsed.data.paymentFrequency !== undefined
          ? { paymentFrequency: parsed.data.paymentFrequency }
          : {}),
        ...(parsed.data.paymentAmount !== undefined
          ? { paymentAmount: parsed.data.paymentAmount }
          : {}),
        ...(parsed.data.nextPaymentDate !== undefined
          ? {
              nextPaymentDate: parsed.data.nextPaymentDate
                ? new Date(parsed.data.nextPaymentDate)
                : null,
            }
          : {}),
        ...(parsed.data.purpose !== undefined ? { purpose: parsed.data.purpose } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      },
    });

    await logFinanceAudit("updated", "loan", id, { user, request }, existing, loan);

    return jsonOk(serializeLoan(loan));
  } catch (error) {
    return handleApiError(error);
  }
}
