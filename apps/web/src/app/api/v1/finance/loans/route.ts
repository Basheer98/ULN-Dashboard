import { NextRequest } from "next/server";
import { loanSchema, toNumber } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceRead, requireFinanceWrite } from "@/lib/finance-auth";
import { logFinanceAudit } from "@/lib/finance-audit";

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

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const status = request.nextUrl.searchParams.get("status");

    const loans = await prisma.loan.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: "desc" },
      include: { payments: true },
    });

    return jsonOk(loans.map(serializeLoan));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const body = await request.json();
    const parsed = loanSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const loan = await prisma.loan.create({
      data: {
        lender: parsed.data.lender,
        originalAmount: parsed.data.originalAmount,
        remainingBalance: parsed.data.originalAmount,
        interestRate: parsed.data.interestRate ?? null,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        paymentFrequency: parsed.data.paymentFrequency,
        paymentAmount: parsed.data.paymentAmount ?? null,
        nextPaymentDate: parsed.data.nextPaymentDate
          ? new Date(parsed.data.nextPaymentDate)
          : null,
        purpose: parsed.data.purpose,
        notes: parsed.data.notes,
      },
    });

    await logFinanceAudit("created", "loan", loan.id, { user, request }, undefined, loan);

    return jsonOk(serializeLoan(loan), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
