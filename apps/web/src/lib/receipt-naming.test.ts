import { describe, expect, it } from "vitest";
import {
  buildReceiptDisplayName,
  buildReceiptGalleryLabel,
  buildReceiptStoragePath,
} from "./receipt-naming";

describe("receipt naming", () => {
  const ctx = {
    transactionDate: "2026-07-13",
    fielderId: "fld_123",
    fielderFirstName: "Mike",
    fielderLastName: "Johnson",
    projectNumber: "ULN-2026-042",
    amount: 47.5,
    description: "Fuel at Sam's Club",
  };

  it("builds readable display names", () => {
    expect(buildReceiptDisplayName(ctx, ".jpg")).toBe(
      "2026-07-13_Mike-Johnson_ULN-2026-042_$47-50_Fuel-at-Sam-s-Club.jpg"
    );
  });

  it("builds fielder/month storage paths", () => {
    expect(buildReceiptStoragePath(ctx, "abcd1234-uuid", ".jpg")).toBe(
      "receipts/fielder-fld_123/2026-07/abcd1234_2026-07-13_Mike-Johnson_ULN-2026-042_$47-50_Fuel-at-Sam-s-Club.jpg"
    );
  });

  it("builds gallery labels", () => {
    expect(buildReceiptGalleryLabel(ctx)).toContain("Mike Johnson");
    expect(buildReceiptGalleryLabel(ctx)).toContain("ULN-2026-042");
    expect(buildReceiptGalleryLabel(ctx)).toContain("$47.50");
  });
});
