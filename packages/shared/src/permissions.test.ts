import { describe, it, expect } from "vitest";
import {
  canAccessRoute,
  canEnterProjects,
  canViewProjectFinancials,
  hasAnyFinanceAccess,
  hasPermission,
  isOfficeRole,
  NAV_BY_ROLE,
} from "./permissions";

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

  it("limits coordinator to dashboard and project entry", () => {
    expect(canAccessRoute("coordinator", "/dashboard")).toBe(true);
    expect(canAccessRoute("coordinator", "/projects")).toBe(true);
    expect(canAccessRoute("coordinator", "/projects/new")).toBe(true);
    expect(canAccessRoute("coordinator", "/projects/abc123")).toBe(true);
    for (const path of [
      "/projects/deleted",
      "/projects/import",
      "/finance",
      "/finance/operations",
      "/invoices",
      "/payments",
      "/reports",
      "/rates",
      "/clients",
      "/fielders",
      "/schedule",
      "/team",
    ]) {
      expect(canAccessRoute("coordinator", path)).toBe(false);
    }
  });

  it("matches nav items to route access", () => {
    for (const role of ["dispatcher", "accountant", "coordinator"] as const) {
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

  it("dispatchers cannot view project financials", () => {
    expect(canViewProjectFinancials("dispatcher")).toBe(false);
    expect(canViewProjectFinancials("admin")).toBe(true);
    expect(canViewProjectFinancials("accountant")).toBe(true);
    expect(canViewProjectFinancials("fielder")).toBe(false);
    expect(canViewProjectFinancials("coordinator")).toBe(false);
  });

  it("coordinator can enter projects but not assign, delete or touch finance", () => {
    expect(canEnterProjects("coordinator")).toBe(true);
    expect(hasPermission("coordinator", "projects:write")).toBe(false);
    expect(hasPermission("coordinator", "attachments:write")).toBe(false);
    expect(hasPermission("coordinator", "clients:read")).toBe(false);
    expect(hasAnyFinanceAccess("coordinator")).toBe(false);
    expect(isOfficeRole("coordinator")).toBe(false);
  });
});
