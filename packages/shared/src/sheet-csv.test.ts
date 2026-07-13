import { describe, expect, it } from "vitest";
import { sheetValuesToCsv } from "./sheet-csv";

describe("sheetValuesToCsv", () => {
  it("joins simple rows", () => {
    expect(
      sheetValuesToCsv([
        ["Project ID", "SQFT"],
        ["PRJ1", "1000"],
      ])
    ).toBe("Project ID,SQFT\nPRJ1,1000");
  });

  it("quotes cells with commas", () => {
    expect(
      sheetValuesToCsv([["PRJ1", "8,658", "Monday, June 8, 2026"]])
    ).toBe('PRJ1,"8,658","Monday, June 8, 2026"');
  });
});
