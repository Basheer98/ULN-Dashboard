import {
  matchBankLinesToLedger,
  parseBankStatement,
  toNumber,
  calculateReconciliationDifference,
} from "@uln/shared";
import { prisma } from "./prisma";
import { ApiError } from "./api";

function signedLedgerAmount(transactionType: string, amount: number): number {
  const credits = new Set([
    "income",
    "owner_contribution",
    "loan_proceeds",
  ]);
  if (credits.has(transactionType)) {
    return Math.abs(amount);
  }
  // expense, owner_draw, loan_payment, transfer, reimbursement_payout
  return -Math.abs(amount);
}

export async function previewBankStatementImport(options: {
  reconciliationId: string;
  statementText: string;
}) {
  const reconciliation = await prisma.bankReconciliation.findUnique({
    where: { id: options.reconciliationId },
    include: { items: true, paymentMethod: true },
  });
  if (!reconciliation) throw new ApiError("Reconciliation not found", 404);
  if (reconciliation.status === "completed") {
    throw new ApiError("Cannot import into a completed reconciliation", 400);
  }

  const parsed = parseBankStatement(options.statementText);
  if (parsed.lines.length === 0) {
    throw new ApiError(
      parsed.errors[0] ?? "No transactions found in statement file",
      400
    );
  }

  const dates = parsed.lines.map((l) => l.date).sort();
  const from = new Date(`${dates[0]}T00:00:00.000Z`);
  const to = new Date(`${dates[dates.length - 1]}T23:59:59.999Z`);
  // widen window ±7 days for matching
  from.setUTCDate(from.getUTCDate() - 7);
  to.setUTCDate(to.getUTCDate() + 7);

  const alreadyLinked = new Set(
    reconciliation.items.map((i) => i.transactionId).filter(Boolean) as string[]
  );

  const transactions = await prisma.financialTransaction.findMany({
    where: {
      paymentMethodId: reconciliation.paymentMethodId,
      transactionDate: { gte: from, lte: to },
      id: alreadyLinked.size ? { notIn: [...alreadyLinked] } : undefined,
    },
    select: {
      id: true,
      amount: true,
      transactionDate: true,
      description: true,
      paymentReference: true,
      transactionNumber: true,
      transactionType: true,
    },
  });

  const ledger = transactions.map((tx) => ({
    id: tx.id,
    amount: signedLedgerAmount(tx.transactionType, toNumber(tx.amount)),
    transactionDate: tx.transactionDate.toISOString(),
    description: tx.description,
    paymentReference: tx.paymentReference,
    transactionNumber: tx.transactionNumber,
    transactionType: tx.transactionType,
  }));

  const matches = matchBankLinesToLedger(parsed.lines, ledger);

  const matched = matches.filter((m) => m.matchedTransactionId).length;
  const unmatched = matches.length - matched;

  return {
    format: parsed.format,
    parseErrors: parsed.errors,
    suggestedEndingBalance: parsed.endingBalance,
    paymentMethod: {
      id: reconciliation.paymentMethod.id,
      name: reconciliation.paymentMethod.name,
    },
    stats: {
      statementLines: parsed.lines.length,
      matched,
      unmatched,
      exact: matches.filter((m) => m.confidence === "exact").length,
      strong: matches.filter((m) => m.confidence === "strong").length,
      weak: matches.filter((m) => m.confidence === "weak").length,
    },
    matches: matches.map((m) => ({
      date: m.statementLine.date,
      description: m.statementLine.description,
      amount: m.statementLine.amount,
      side: m.statementLine.side,
      reference: m.statementLine.reference,
      matchedTransactionId: m.matchedTransactionId,
      confidence: m.confidence,
      reason: m.reason,
    })),
  };
}

export async function applyBankStatementImport(options: {
  reconciliationId: string;
  statementText: string;
  /** Only clear exact/strong matches by default; weak need confirm */
  clearConfidences?: Array<"exact" | "strong" | "weak">;
  includeUnmatchedAsManual?: boolean;
}) {
  const preview = await previewBankStatementImport(options);
  const clearSet = new Set(options.clearConfidences ?? ["exact", "strong"]);
  const includeUnmatched = options.includeUnmatchedAsManual ?? true;

  const reconciliation = await prisma.bankReconciliation.findUnique({
    where: { id: options.reconciliationId },
    include: { items: true },
  });
  if (!reconciliation) throw new ApiError("Reconciliation not found", 404);

  const existingItems = reconciliation.items.map((item) => ({
    transactionId: item.transactionId,
    description: item.description,
    amount: toNumber(item.amount),
    transactionDate: item.transactionDate?.toISOString() ?? null,
    isCleared: item.isCleared,
    isManual: item.isManual,
  }));

  const usedTx = new Set(
    existingItems.map((i) => i.transactionId).filter(Boolean) as string[]
  );

  const newItems: typeof existingItems = [];

  for (const match of preview.matches as Array<{
    date: string;
    description: string;
    amount: number;
    matchedTransactionId: string | null;
    confidence: "exact" | "strong" | "weak" | "none";
    reason: string;
  }>) {
    if (match.matchedTransactionId) {
      if (usedTx.has(match.matchedTransactionId)) continue;
      usedTx.add(match.matchedTransactionId);
      newItems.push({
        transactionId: match.matchedTransactionId,
        description: match.description,
        amount: match.amount,
        transactionDate: `${match.date}T12:00:00.000Z`,
        isCleared: clearSet.has(match.confidence),
        isManual: false,
      });
    } else if (includeUnmatched) {
      newItems.push({
        transactionId: null,
        description: `[Bank] ${match.description}`,
        amount: match.amount,
        transactionDate: `${match.date}T12:00:00.000Z`,
        isCleared: false,
        isManual: true,
      });
    }
  }

  const allItems = [...existingItems, ...newItems];

  await prisma.$transaction(async (tx) => {
    await tx.reconciliationItem.deleteMany({
      where: { reconciliationId: options.reconciliationId },
    });
    if (allItems.length) {
      await tx.reconciliationItem.createMany({
        data: allItems.map((item) => ({
          reconciliationId: options.reconciliationId,
          transactionId: item.transactionId,
          description: item.description,
          amount: item.amount,
          transactionDate: item.transactionDate ? new Date(item.transactionDate) : null,
          isCleared: item.isCleared,
          isManual: item.isManual,
        })),
      });
    }

    const clearedTotal = allItems
      .filter((i) => i.isCleared)
      .reduce((sum, i) => sum + i.amount, 0);

    const difference = calculateReconciliationDifference(
      toNumber(reconciliation.startingBalance),
      clearedTotal,
      toNumber(reconciliation.endingBalance)
    );

    await tx.bankReconciliation.update({
      where: { id: options.reconciliationId },
      data: {
        clearedTotal,
        difference,
        status: difference === 0 ? "balanced" : "in_progress",
        ...(preview.suggestedEndingBalance != null &&
        toNumber(reconciliation.endingBalance) === 0
          ? { endingBalance: preview.suggestedEndingBalance }
          : {}),
      },
    });
  });

  return {
    added: newItems.length,
    cleared: newItems.filter((i) => i.isCleared).length,
    unmatchedManual: newItems.filter((i) => i.isManual && !i.isCleared).length,
    previewStats: preview.stats,
  };
}

