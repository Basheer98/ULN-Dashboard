export type UserRole = "admin" | "dispatcher" | "accountant" | "fielder";

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
  | "users:read"
  | "users:write"
  | "schedule:read"
  | "rates:read"
  | "rates:write"
  | "finance:read"
  | "finance:write"
  | "finance:admin";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    "projects:read", "projects:write",
    "clients:read", "clients:write",
    "fielders:read", "fielders:write",
    "invoices:read", "invoices:write",
    "payments:read", "payments:write",
    "reports:read", "users:read", "users:write",
    "schedule:read", "rates:read", "rates:write",
    "finance:read", "finance:write", "finance:admin",
  ],
  dispatcher: [
    "projects:read", "projects:write",
    "clients:read", "clients:write",
    "fielders:read", "fielders:write",
    "schedule:read", "reports:read",
  ],
  accountant: [
    "projects:read", "clients:read", "fielders:read",
    "invoices:read", "invoices:write",
    "payments:read", "payments:write",
    "reports:read", "rates:read", "rates:write",
    "finance:read", "finance:write",
  ],
  fielder: [],
};

export function hasPermission(role: string | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role as UserRole]?.includes(permission) ?? false;
}

export const PROJECT_STATUSES = [
  "draft",
  "assigned",
  "in_progress",
  "complete",
  "invoiced",
  "paid",
  "cancelled",
] as const;

export const ASSIGNMENT_STATUSES = [
  "assigned",
  "accepted",
  "in_progress",
  "complete",
  "cancelled",
] as const;
