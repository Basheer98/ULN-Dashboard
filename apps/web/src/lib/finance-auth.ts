import type { SessionUser } from "./auth";
import { hasPermission } from "@uln/shared";
import { ApiError } from "./api";

export function requireFinanceRead(user: SessionUser | null): SessionUser {
  if (!user) throw new ApiError("Unauthorized", 401);
  if (
    hasPermission(user.role, "finance:read") ||
    hasPermission(user.role, "finance:admin") ||
    hasPermission(user.role, "expense:self:read")
  ) {
    return user;
  }
  throw new ApiError("Forbidden", 403);
}

export function requireFinanceWrite(user: SessionUser | null): SessionUser {
  if (!user) throw new ApiError("Unauthorized", 401);
  if (hasPermission(user.role, "finance:write") || hasPermission(user.role, "finance:admin")) {
    return user;
  }
  throw new ApiError("Forbidden", 403);
}

export function requireFinanceAdmin(user: SessionUser | null): SessionUser {
  if (!user) throw new ApiError("Unauthorized", 401);
  if (hasPermission(user.role, "finance:admin") || hasPermission(user.role, "finance:settings")) {
    return user;
  }
  throw new ApiError("Forbidden", 403);
}

export function requireFielderSelf(user: SessionUser | null): SessionUser {
  if (!user) throw new ApiError("Unauthorized", 401);
  if (!user.fielderId) throw new ApiError("Fielder profile required", 403);
  return user;
}

export function canViewTransaction(user: SessionUser, fielderId: string | null | undefined): boolean {
  if (hasPermission(user.role, "finance:read") || hasPermission(user.role, "finance:admin")) {
    return true;
  }
  return !!user.fielderId && user.fielderId === fielderId;
}
