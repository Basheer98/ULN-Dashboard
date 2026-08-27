import type { UserRole } from "@uln/database";

export type Permission =
  | "projects:read"
  | "projects:write"
  | "clients:read"
  | "clients:write"
  | "fielders:read"
  | "fielders:write"
  | "invoices:read"
  | "invoices:write"
  | "payments:read"
  | "payments:write"
  | "reports:read"
  | "reports:export"
  | "users:read"
  | "users:write"
  | "schedule:read"
  | "schedule:write"
  | "rates:read"
  | "rates:write"
  | "finance:admin"
  | "finance:read"
  | "finance:write"
  | "finance:delete"
  | "finance:export"
  | "finance:reconcile"
  | "finance:settings"
  | "expense:self:create"
  | "expense:self:read"
  | "mileage:self:create"
  | "receipt:self:upload";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "projects:read", "projects:write",
    "clients:read", "clients:write",
    "fielders:read", "fielders:write",
    "invoices:read", "invoices:write",
    "payments:read", "payments:write",
    "reports:read", "reports:export",
    "users:read", "users:write",
    "schedule:read", "schedule:write",
    "rates:read", "rates:write",
    "finance:admin", "finance:read", "finance:write", "finance:delete",
    "finance:export", "finance:reconcile", "finance:settings",
  ],
  dispatcher: [
    "projects:read", "projects:write",
    "clients:read", "clients:write",
    "fielders:read", "fielders:write",
    "schedule:read", "schedule:write",
    "reports:read",
  ],
  accountant: [
    "projects:read",
    "clients:read",
    "fielders:read",
    "invoices:read", "invoices:write",
    "payments:read", "payments:write",
    "reports:read", "reports:export",
    "rates:read", "rates:write",
    "finance:read", "finance:write", "finance:export", "finance:reconcile",
  ],
  fielder: [
    "expense:self:create", "expense:self:read",
    "mileage:self:create", "receipt:self:upload",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyFinanceAccess(role: UserRole): boolean {
  return (
    hasPermission(role, "finance:read") ||
    hasPermission(role, "finance:admin") ||
    hasPermission(role, "expense:self:read")
  );
}

export function canAccessRoute(role: UserRole, path: string): boolean {
  if (role === "admin") return true;
  if (path.startsWith("/dashboard")) return true;
  if (path.startsWith("/finance")) {
    if (path.startsWith("/finance/settings")) {
      return hasPermission(role, "finance:settings");
    }
    if (path.startsWith("/finance/reconciliation")) {
      return hasPermission(role, "finance:reconcile");
    }
    if (path.startsWith("/finance/audit")) {
      return hasPermission(role, "finance:admin") || hasPermission(role, "finance:read");
    }
    return hasPermission(role, "finance:read") || hasPermission(role, "finance:admin");
  }
  if (path.startsWith("/projects")) return hasPermission(role, "projects:read");
  if (path.startsWith("/clients")) return hasPermission(role, "clients:read");
  if (path.startsWith("/fielders")) return hasPermission(role, "fielders:read");
  if (path.startsWith("/invoices")) return hasPermission(role, "invoices:read");
  if (path.startsWith("/payments")) return hasPermission(role, "payments:read");
  if (path.startsWith("/reports")) return hasPermission(role, "reports:read");
  if (path.startsWith("/schedule")) return hasPermission(role, "schedule:read");
  if (path.startsWith("/team")) return hasPermission(role, "users:read");
  if (path.startsWith("/rates")) return hasPermission(role, "rates:read");
  return false;
}

export const NAV_BY_ROLE: Record<UserRole, string[]> = {
  admin: [
    "/dashboard", "/projects", "/schedule", "/clients", "/fielders",
    "/invoices", "/payments", "/finance", "/reports", "/rates", "/team",
  ],
  dispatcher: ["/dashboard", "/projects", "/schedule", "/clients", "/fielders", "/reports"],
  accountant: [
    "/dashboard", "/projects", "/clients", "/fielders",
    "/invoices", "/payments", "/finance", "/reports", "/rates",
  ],
  fielder: [],
};

export const FINANCE_NAV = [
  { href: "/finance", label: "Overview" },
  { href: "/finance/expenses", label: "Expenses" },
  { href: "/finance/expenses/approvals", label: "Approvals" },
  { href: "/finance/income", label: "Income" },
  { href: "/finance/receipts", label: "Receipts" },
  { href: "/finance/mileage", label: "Mileage" },
  { href: "/finance/trips", label: "Trips" },
  { href: "/finance/vehicles", label: "Vehicles" },
  { href: "/finance/payments", label: "Invoice Payments" },
  { href: "/finance/profitability", label: "Profitability" },
  { href: "/finance/reconciliation", label: "Reconciliation" },
  { href: "/finance/loans", label: "Loans" },
  { href: "/finance/reports", label: "Reports" },
  { href: "/finance/audit", label: "Audit Log" },
  { href: "/finance/settings", label: "Settings" },
];
