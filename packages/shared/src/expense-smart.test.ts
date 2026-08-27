import { describe, expect, it } from "vitest";
import {
  evaluateExpensePolicy,
  findDuplicateExpenses,
  parseReceiptAmountFromText,
  parseReceiptDateFromText,
  parseReceiptText,
  parseReceiptVendorFromText,
  scoreApprovalPriority,
  sortByApprovalPriority,
  suggestCategory,
} from "./expense-smart";

describe("receipt OCR parsing", () => {
  const sample = `HOME DEPOT #1234
123 MAIN ST
BROOMFIELD CO 80020
08/04/2026

SUBTOTAL         $42.18
TAX               $3.37
TOTAL            $45.55
THANK YOU`;

  it("extracts amount, date, and vendor from receipt text", () => {
    const parsed = parseReceiptText(sample);
    expect(parsed.amount).toBe(45.55);
    expect(parsed.transactionDate).toBe("2026-08-04");
    expect(parsed.vendorName).toBe("HOME DEPOT #1234");
  });

  it("prefers labeled totals", () => {
    expect(parseReceiptAmountFromText("items $12.00\nTOTAL $88.50")).toBe(88.5);
  });

  it("parses common date formats", () => {
    expect(parseReceiptDateFromText("Date: 12/31/2025")).toBe("2025-12-31");
    expect(parseReceiptDateFromText("2025-11-02")).toBe("2025-11-02");
  });

  it("picks a reasonable vendor line", () => {
    expect(parseReceiptVendorFromText(sample)).toBe("HOME DEPOT #1234");
  });
});

describe("expense policy", () => {
  const base = {
    amount: 30,
    expenseStatus: "submitted",
    hasReceipt: false,
    receiptRequiredAbove: 25,
    expenseReviewAbove: 200,
  };

  it("blocks submit without receipt above threshold", () => {
    const result = evaluateExpensePolicy(base);
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain("Receipt required");
  });

  it("routes high amounts to pending review", () => {
    const result = evaluateExpensePolicy({
      ...base,
      amount: 250,
      hasReceipt: true,
    });
    expect(result.resolvedStatus).toBe("pending_review");
    expect(result.reviewReason).toContain("review threshold");
  });

  it("does not demote already-approved expenses to pending review", () => {
    const result = evaluateExpensePolicy({
      ...base,
      amount: 250,
      hasReceipt: true,
      expenseStatus: "approved",
    });
    expect(result.resolvedStatus).toBe("approved");
    expect(result.reviewReason).toBeNull();
  });

  it("requires duplicate acknowledgment", () => {
    const result = evaluateExpensePolicy({
      ...base,
      hasReceipt: true,
      duplicateCount: 1,
      acknowledgeDuplicate: false,
    });
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toContain("duplicate");
  });
});

describe("category suggestion", () => {
  const categories = [
    { id: "cat-fuel", name: "Fuel" },
    { id: "cat-materials", name: "Materials" },
  ];
  const vendors = [{ id: "v-home", name: "Home Depot", defaultCategoryId: "cat-materials" }];

  it("uses vendor default category", () => {
    const suggestion = suggestCategory({
      description: "supplies",
      vendorName: "Home Depot",
      categories,
      vendors,
      history: [],
    });
    expect(suggestion.categoryId).toBe("cat-materials");
    expect(suggestion.confidence).toBe("high");
  });

  it("matches keywords when vendor unknown", () => {
    const suggestion = suggestCategory({
      description: "diesel fill-up",
      vendorName: null,
      categories,
      vendors,
      history: [],
    });
    expect(suggestion.categoryId).toBe("cat-fuel");
  });
});

describe("duplicate detection", () => {
  const existing = [
    {
      id: "e1",
      transactionNumber: "TXN-2026-0001",
      amount: 45.55,
      transactionDate: "2026-08-04T00:00:00.000Z",
      description: "Home Depot",
      fielderId: "f1",
    },
    {
      id: "e2",
      transactionNumber: "TXN-2026-0002",
      amount: 12,
      transactionDate: "2026-08-01T00:00:00.000Z",
      description: "Coffee",
      fielderId: "f1",
    },
  ];

  it("flags same fielder, amount, and date", () => {
    const matches = findDuplicateExpenses(
      { amount: 45.55, transactionDate: "2026-08-04", fielderId: "f1" },
      existing
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.confidence).toBe("exact");
  });

  it("flags likely duplicates within one day", () => {
    const matches = findDuplicateExpenses(
      { amount: 45.55, transactionDate: "2026-08-05", fielderId: "f1" },
      existing
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.confidence).toBe("likely");
  });
});

describe("approval priority", () => {
  it("scores pending_review and missing receipt higher", () => {
    const low = scoreApprovalPriority({
      id: "a",
      amount: 20,
      status: "submitted",
      createdAt: new Date().toISOString(),
      hasReceipt: true,
    });
    const high = scoreApprovalPriority({
      id: "b",
      amount: 250,
      status: "pending_review",
      createdAt: new Date().toISOString(),
      hasReceipt: false,
      isDuplicate: true,
    });
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.reasons).toContain("Needs review");
    expect(high.reasons).toContain("No receipt");
  });

  it("sorts highest priority first", () => {
    const sorted = sortByApprovalPriority([
      {
        id: "normal",
        amount: 30,
        status: "submitted",
        createdAt: "2026-08-01T00:00:00.000Z",
        hasReceipt: true,
      },
      {
        id: "urgent",
        amount: 300,
        status: "pending_review",
        createdAt: "2026-08-04T00:00:00.000Z",
        hasReceipt: false,
        isDuplicate: true,
      },
    ]);
    expect(sorted[0]?.id).toBe("urgent");
  });
});
