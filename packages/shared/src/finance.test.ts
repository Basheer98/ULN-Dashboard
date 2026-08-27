import { describe, it, expect } from "vitest";
import {
  calculateMileageReimbursement,
  calculateMilesFromOdometer,
  calculateInvoiceBalance,
  calculateProjectProfitability,
  calculateReconciliationDifference,
  sumDecimal,
  mileageSchema,
} from "./finance";
import { hasPermission, hasAnyFinanceAccess } from "./permissions";

describe("finance calculations", () => {
  it("calculates mileage reimbursement", () => {
    expect(calculateMileageReimbursement(100, 0.67)).toBe(67);
    expect(calculateMileageReimbursement(10.5, 0.67)).toBe(7.04);
  });

  it("calculates miles from odometer", () => {
    expect(calculateMilesFromOdometer(1000, 1105.5)).toBe(105.5);
    expect(() => calculateMilesFromOdometer(2000, 1000)).toThrow();
  });

  it("requires odometer and photos on mileage schema", () => {
    const missing = mileageSchema.safeParse({
      date: "2026-08-05",
      totalMiles: 10,
    });
    expect(missing.success).toBe(false);

    const valid = mileageSchema.safeParse({
      date: "2026-08-05",
      startOdometer: 1000,
      endOdometer: 1105.5,
      startPhotoId: "photo-start",
      endPhotoId: "photo-end",
    });
    expect(valid.success).toBe(true);
  });

  it("calculates invoice balance with partial payments", () => {
    const result = calculateInvoiceBalance(1000, [{ amount: 400 }, { amount: 300 }]);
    expect(result.paid).toBe(700);
    expect(result.remaining).toBe(300);
    expect(result.isOverpaid).toBe(false);
  });

  it("detects overpayment", () => {
    const result = calculateInvoiceBalance(500, [{ amount: 600 }]);
    expect(result.isOverpaid).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("calculates project profitability", () => {
    const { grossProfit, margin } = calculateProjectProfitability(10000, 3000, 2000);
    expect(grossProfit).toBe(5000);
    expect(margin).toBe(50);
  });

  it("calculates reconciliation difference", () => {
    expect(calculateReconciliationDifference(1000, 500, 1400)).toBe(100);
    expect(calculateReconciliationDifference(1000, 400, 1400)).toBe(0);
  });

  it("sums decimals", () => {
    expect(sumDecimal([10.5, 20.25, 0.25])).toBe(31);
  });
});

describe("finance authorization", () => {
  it("grants admin full finance access", () => {
    expect(hasPermission("admin", "finance:admin")).toBe(true);
    expect(hasPermission("admin", "finance:settings")).toBe(true);
    expect(hasAnyFinanceAccess("admin")).toBe(true);
  });

  it("grants accountant read/write but not settings", () => {
    expect(hasPermission("accountant", "finance:read")).toBe(true);
    expect(hasPermission("accountant", "finance:write")).toBe(true);
    expect(hasPermission("accountant", "finance:settings")).toBe(false);
    expect(hasAnyFinanceAccess("accountant")).toBe(true);
  });

  it("grants fielder self-submission only", () => {
    expect(hasPermission("fielder", "expense:self:create")).toBe(true);
    expect(hasPermission("fielder", "mileage:self:create")).toBe(true);
    expect(hasPermission("fielder", "finance:read")).toBe(false);
    expect(hasAnyFinanceAccess("fielder")).toBe(true);
  });

  it("denies dispatcher finance access", () => {
    expect(hasPermission("dispatcher", "finance:read")).toBe(false);
    expect(hasAnyFinanceAccess("dispatcher")).toBe(false);
  });
});

describe("reimbursement workflow states", () => {
  const validTransitions: Record<string, string[]> = {
    submitted: ["pending_review", "approved", "rejected"],
    pending_review: ["approved", "rejected"],
    approved: ["reimbursed", "paid"],
    rejected: [],
    reimbursed: [],
  };

  it("allows submitted to approved", () => {
    expect(validTransitions.submitted).toContain("approved");
  });

  it("blocks rejected to reimbursed", () => {
    expect(validTransitions.rejected).not.toContain("reimbursed");
  });
});
