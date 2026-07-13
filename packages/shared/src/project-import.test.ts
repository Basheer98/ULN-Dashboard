import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  matchFielderName,
  buildFielderLookup,
  parseProjectImportSheet,
  parseQfield,
  parseSiteAddress,
  parseSqft,
  mapProjectStatus,
} from "./project-import";

const fielders = buildFielderLookup([
  { id: "f1", firstName: "Vishnu", lastName: "K" },
  { id: "f2", firstName: "Amaranth", lastName: "R" },
  { id: "f3", firstName: "Sai", lastName: "Krishna" },
  { id: "f4", firstName: "Dinesh", lastName: "P" },
  { id: "f5", firstName: "Poorna", lastName: "S" },
]);

describe("project import parsing", () => {
  it("parses comma-formatted SQFT", () => {
    expect(parseSqft("8,658")).toBe(8658);
    expect(parseSqft("24528")).toBe(24528);
    expect(parseSqft("")).toBeNull();
    expect(parseSqft("abc")).toBeNull();
  });

  it("parses Qfield values", () => {
    expect(parseQfield("Qfield_1")).toBe(1);
    expect(parseQfield("Qfield_2")).toBe(2);
    expect(parseQfield("2")).toBe(2);
  });

  it("parses full US addresses", () => {
    const parsed = parseSiteAddress(
      "3123 W 133rd Ave, Broomfield, CO 80020",
      1
    );
    expect(parsed.state).toBe("CO");
    expect(parsed.city).toBe("Broomfield");
    expect(parsed.zip).toBe("80020");
    expect(parsed.warnings).toHaveLength(0);
  });

  it("handles Nebraka placeholder with Qfield_2", () => {
    const parsed = parseSiteAddress("Nebraka", 2);
    expect(parsed.state).toBe("NE");
    expect(parsed.warnings.some((w) => w.code === "placeholder_address")).toBe(true);
  });

  it("maps status from tracker columns", () => {
    expect(
      mapProjectStatus({
        fielderName: "Vishnu",
        fieldingStatus: "Completed",
        dataStatus: "Completed",
        submitted: "Submitted",
      })
    ).toBe("invoiced");

    expect(
      mapProjectStatus({
        fielderName: "Vishnu",
        fieldingStatus: "Completed",
        dataStatus: "Completed",
        submitted: "",
      })
    ).toBe("complete");
  });

  it("matches fielder names including slashes and two-word names", () => {
    const sai = matchFielderName("Sai Krishna", fielders);
    expect(sai.fielder?.id).toBe("f3");

    const split = matchFielderName("Poorna/Dinesh", fielders);
    expect(split.fielder?.id).toBe("f5");
    expect(split.issues.some((i) => i.code === "split_fielder")).toBe(true);
  });

  it("parses tracker CSV headers and rows", () => {
    const csv = `Project ID,Qfield,SQFT,Aerial ,ECD,Address,Feilder,Assigned,Feilding Status ,Data Status,Submitted,Notes
PRJ25374,Qfield_1,"8,658",0,"Monday, June 8, 2026","3123 W 133rd Ave, Broomfield, CO 80020",Vishnu ,Aissgned,Completed,Completed,Submitted,
PRJ25371,Qfield_1,"19,108",0,"Thursday, June 11, 2026","2923 W 132nd Ave, Broomfield, CO 80020",,,,,,`;

    const result = parseProjectImportSheet(csv, [
      { id: "f1", firstName: "Vishnu", lastName: "K" },
    ]);

    expect(result.format).toBe("tracker");
    expect(result.rows).toHaveLength(2);

    const first = result.rows[0];
    expect(first.projectNumber).toBe("PRJ25374");
    expect(first.sqft).toBe(8658);
    expect(first.qfield).toBe(1);
    expect(first.state).toBe("CO");
    expect(first.fielderId).toBe("f1");
    expect(first.projectStatus).toBe("invoiced");
    expect(first.importable).toBe(true);

    const unassigned = result.rows[1];
    expect(unassigned.fielderId).toBeNull();
    expect(unassigned.projectStatus).toBe("draft");
  });

  it("flags duplicate project numbers in the same file", () => {
    const csv = `Project ID,Qfield,SQFT,Aerial ,ECD,Address,Feilder
PRJ25371,Qfield_1,"8,658",0,"Monday, June 8, 2026","3123 W 133rd Ave, Broomfield, CO 80020",Vishnu
PRJ25371,Qfield_1,"9,000",0,"Tuesday, June 9, 2026","10541 Oak St, Westminster, CO 80021",Vishnu`;

    const result = parseProjectImportSheet(csv, [
      { id: "f1", firstName: "Vishnu", lastName: "K" },
    ]);

    expect(result.duplicateProjectNumbers).toContain("PRJ25371");
    expect(result.rows.every((r) => !r.importable)).toBe(true);
  });

  it("rejects rows with zero SQFT", () => {
    const csv = `Project ID,Qfield,SQFT,Aerial ,ECD,Address,Feilder
PRJ0001,Qfield_1,0,0,"Monday, June 8, 2026","3123 W 133rd Ave, Broomfield, CO 80020",Vishnu`;

    const result = parseProjectImportSheet(csv, [
      { id: "f1", firstName: "Vishnu", lastName: "K" },
    ]);

    expect(result.rows[0].importable).toBe(false);
    expect(result.rows[0].issues.some((i) => i.code === "zero_sqft")).toBe(true);
  });
});

describe("June tracker fixture", () => {
  const fixturePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../apps/web/src/lib/__fixtures__/project-tracker-june.csv"
  );

  it("parses the operations CSV fixture without structural errors", () => {
    const csv = readFileSync(fixturePath, "utf8");
    const result = parseProjectImportSheet(csv, [
      { id: "f1", firstName: "Vishnu", lastName: "" },
      { id: "f2", firstName: "Amaranth", lastName: "" },
      { id: "f3", firstName: "Vineeth", lastName: "" },
      { id: "f4", firstName: "Varun", lastName: "" },
      { id: "f5", firstName: "Basheer", lastName: "" },
      { id: "f6", firstName: "Dinesh", lastName: "" },
      { id: "f7", firstName: "Sai", lastName: "Krishna" },
      { id: "f8", firstName: "Nikhil", lastName: "" },
      { id: "f9", firstName: "Vamshi", lastName: "" },
      { id: "f10", firstName: "Poorna", lastName: "" },
    ]);

    expect(result.format).toBe("tracker");
    expect(result.stats.total).toBeGreaterThan(70);
    expect(result.duplicateProjectNumbers).toContain("PRJ25371");
    const importable = result.rows.filter((r) => r.importable);
    expect(importable.length).toBeGreaterThan(60);
  });
});
