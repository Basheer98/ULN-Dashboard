import { NextRequest } from "next/server";
import { invoicePaymentSchema, calculateInvoiceBalance, toNumber } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";
import {
  generateTransactionNumber,
  serializeTransaction,
  transactionInclude,
} from "@/lib/finance-transactions";

export async function POST(request: NextRequest) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const body = await request.json();
    const parsed = invoicePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: parsed.data.invoiceId },
      include: { invoicePayments: true, client: true, project: true },
    });
    if (!invoice) return jsonError("Invoice not found", 404);
    if (invoice.status === "paid") {
      return jsonError("Invoice cannot accept payments", 400);
    }

    const totalAmount = toNumber(invoice.totalAmount);
    const { remaining } = calculateInvoiceBalance(
      totalAmount,
      invoice.invoicePayments.map((p) => ({ amount: toNumber(p.amount) }))
    );

    if (parsed.data.amount > remaining && !parsed.data.writeOffRemainder) {
      return jsonError(`Payment exceeds remaining balance of ${remaining}`, 400);
    }

    const transactionNumber = await generateTransactionNumber();
    const paidAt = new Date(parsed.data.paidAt);

    const result = await prisma.$transaction(async (tx) => {
      const incomeTx = await tx.financialTransaction.create({
        data: {
          transactionNumber,
          transactionType: "income",
          transactionDate: paidAt,
          amount: parsed.data.amount,
          description: `Payment for invoice ${invoice.invoiceNumber}`,
          incomeCategory: "client_payment",
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          projectId: invoice.projectId,
          paymentMethodId: parsed.data.paymentMethodId ?? null,
          paymentReference: parsed.data.reference,
          createdById: user.id,
        },
        include: transactionInclude,
      });

      const payment = await tx.invoicePayment.create({
        data: {
          invoiceId: invoice.id,
          transactionId: incomeTx.id,
          amount: parsed.data.amount,
          paidAt,
          reference: parsed.data.reference,
        },
        include: { invoice: true, transaction: true },
      });

      const allPayments = [
        ...invoice.invoicePayments.map((p) => ({ amount: toNumber(p.amount) })),
        { amount: parsed.data.amount },
      ];
      const { paid, remaining: newRemaining } = calculateInvoiceBalance(totalAmount, allPayments);

      let newStatus = invoice.status;
      if (parsed.data.writeOffRemainder && parsed.data.amount <= remaining) {
        newStatus = "paid";
      } else if (newRemaining <= 0) {
        newStatus = "paid";
      } else if (paid > 0) {
        newStatus = "partial";
      }

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: newStatus,
          paidAt: newStatus === "paid" ? paidAt : invoice.paidAt,
        },
        include: { client: true, project: true, invoicePayments: true },
      });

      if (parsed.data.paymentMethodId) {
        const method = await tx.paymentMethod.findUnique({
          where: { id: parsed.data.paymentMethodId },
        });
        if (method) {
          await tx.paymentMethod.update({
            where: { id: method.id },
            data: { currentBalance: toNumber(method.currentBalance) + parsed.data.amount },
          });
        }
      }

      return { payment, incomeTx, updatedInvoice };
    });

    await logFinanceAudit(
      "created",
      "invoice_payment",
      result.payment.id,
      { user, request },
      undefined,
      result.payment
    );

    return jsonOk(
      {
        payment: {
          ...result.payment,
          amount: toNumber(result.payment.amount),
        },
        transaction: serializeTransaction(result.incomeTx),
        invoice: result.updatedInvoice,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
