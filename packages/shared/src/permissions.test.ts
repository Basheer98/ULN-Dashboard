import { describe, it, expect } from "vitest";
import { canAccessRoute, hasPermission, NAV_BY_ROLE } from "./permissions";

describe("canAccessRoute", () => {
  it("allows admin everywhere", () => {
    expect(canAccessRoute("admin", "/finance/settings")).toBe(true);
    expect(canAccessRoute("admin", "/team")).toBe(true);
  });

  it("blocks dispatcher from finance and invoices", () => {
    expect(canAccessRoute("dispatcher", "/finance")).toBe(false);
    expect(canAccessRoute("dispatcher", "/invoices")).toBe(false);
    expect(canAccessRoute("dispatcher", "/projects")).toBe(true);
    expect(canAccessRoute("dispatcher", "/clients")).toBe(true);
  });

  it("allows accountant finance but not settings", () => {
    expect(canAccessRoute("accountant", "/finance/expenses")).toBe(true);
    expect(canAccessRoute("accountant", "/finance/settings")).toBe(false);
    expect(canAccessRoute("accountant", "/finance/reconciliation")).toBe(true);
  });

  it("blocks fielder from dashboard routes", () => {
    expect(canAccessRoute("fielder", "/projects")).toBe(false);
    expect(canAccessRoute("fielder", "/dashboard")).toBe(true);
  });

  it("matches nav items to route access", () => {
    for (const role of ["dispatcher", "accountant"] as const) {
      for (const href of NAV_BY_ROLE[role]) {
        expect(canAccessRoute(role, href)).toBe(true);
      }
    }
  });
});

describe("role permissions consistency", () => {
  it("dispatcher cannot write invoices", () => {
    expect(hasPermission("dispatcher", "invoices:write")).toBe(false);
  });

  it("accountant can export reports", () => {
    expect(hasPermission("accountant", "reports:export")).toBe(true);
  });

  it("fielder has self expense access but not office finance:read", () => {
    expect(hasPermission("fielder", "expense:self:read")).toBe(true);
    expect(hasPermission("fielder", "finance:read")).toBe(false);
    expect(hasPermission("fielder", "finance:admin")).toBe(false);
  });
});
