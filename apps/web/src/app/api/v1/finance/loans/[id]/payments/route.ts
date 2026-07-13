import { NextRequest } from "next/server";
import { loanPaymentSchema, toNumber } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import { generateTransactionNumber } from "@/lib/finance-transactions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id: loanId } = await params;
    const body = await request.json();
    const parsed = loanPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) return jsonError("Loan not found", 404);
    if (loan.status !== "active") return jsonError("Loan is not active", 400);

    const feeAmount = parsed.data.feeAmount ?? 0;
    const totalAmount = parsed.data.principalAmount + parsed.data.interestAmount + feeAmount;
    const remaining = toNumber(loan.remainingBalance);

    if (parsed.data.principalAmount > remaining) {
      return jsonError(`Principal exceeds remaining balance of ${remaining}`, 400);
    }

    const paidAt = new Date(parsed.data.paidAt);
    const transactionNumber = await generateTransactionNumber();

    const result = await prisma.$transaction(async (tx) => {
      const financeTx = await tx.financialTransaction.create({
        data: {
          transactionNumber,
          transactionType: "loan_payment",
          transactionDate: paidAt,
          amount: totalAmount,
          description: `Loan payment to ${loan.lender}`,
          paymentMethodId: parsed.data.paymentMethodId ?? null,
          paymentReference: parsed.data.reference,
          createdById: user.id,
        },
      });

      const payment = await tx.loanPayment.create({
        data: {
          loanId,
          transactionId: financeTx.id,
          paidAt,
          principalAmount: parsed.data.principalAmount,
          interestAmount: parsed.data.interestAmount,
          feeAmount,
          totalAmount,
          reference: parsed.data.reference,
        },
      });

      const newRemaining = remaining - parsed.data.principalAmount;
      const updatedLoan = await tx.loan.update({
        where: { id: loanId },
        data: {
          remainingBalance: Math.max(0, newRemaining),
          status: newRemaining <= 0 ? "paid_off" : "active",
        },
      });

      if (parsed.data.paymentMethodId) {
        const method = await tx.paymentMethod.findUnique({
          where: { id: parsed.data.paymentMethodId },
        });
        if (method) {
          await tx.paymentMethod.update({
            where: { id: method.id },
            data: { currentBalance: toNumber(method.currentBalance) - totalAmount },
          });
        }
      }

      return { payment, financeTx, updatedLoan };
    });

    await logFinanceAudit(
      "created",
      "loan_payment",
      result.payment.id,
      { user, request },
      undefined,
      result.payment
    );

    return jsonOk(
      {
        payment: {
          ...result.payment,
          principalAmount: toNumber(result.payment.principalAmount),
          interestAmount: toNumber(result.payment.interestAmount),
          feeAmount: toNumber(result.payment.feeAmount),
          totalAmount: toNumber(result.payment.totalAmount),
        },
        loan: {
          ...result.updatedLoan,
          originalAmount: toNumber(result.updatedLoan.originalAmount),
          remainingBalance: toNumber(result.updatedLoan.remainingBalance),
        },
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
