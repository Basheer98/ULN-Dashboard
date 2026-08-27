import type { SessionUser } from "./auth";
import { hasPermission } from "@uln/shared";
import { ApiError } from "./api";
import { prisma } from "./prisma";

export function requireFinanceRead(user: SessionUser | null): SessionUser {
  if (!user) throw new ApiError("Unauthorized", 401);
  if (hasPermission(user.role, "finance:read") || hasPermission(user.role, "finance:admin")) {
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

/** Authenticated user who may view a single expense/mileage row after canViewTransaction. */
export function requireAuthUser(user: SessionUser | null): SessionUser {
  if (!user) throw new ApiError("Unauthorized", 401);
  return user;
}

export function canViewTransaction(user: SessionUser, fielderId: string | null | undefined): boolean {
  if (hasPermission(user.role, "finance:read") || hasPermission(user.role, "finance:admin")) {
    return true;
  }
  return !!user.fielderId && user.fielderId === fielderId;
}

export function canViewReceipt(
  user: SessionUser,
  receipt: {
    uploadedById?: string | null;
    transaction?: { fielderId: string | null } | null;
  }
): boolean {
  if (hasPermission(user.role, "finance:read") || hasPermission(user.role, "finance:admin")) {
    return true;
  }
  if (receipt.uploadedById && receipt.uploadedById === user.id) return true;
  return canViewTransaction(user, receipt.transaction?.fielderId);
}

export function assertCanViewTransaction(
  user: SessionUser,
  fielderId: string | null | undefined
): void {
  if (!canViewTransaction(user, fielderId)) {
    throw new ApiError("Forbidden", 403);
  }
}

export function assertCanViewReceipt(
  user: SessionUser,
  receipt: {
    uploadedById?: string | null;
    transaction?: { fielderId: string | null } | null;
  }
): void {
  if (!canViewReceipt(user, receipt)) {
    throw new ApiError("Forbidden", 403);
  }
}

/** Office staff with projects access, or a fielder assigned to the project. */
export async function assertCanAccessProjectFiles(
  user: SessionUser,
  projectId: string
): Promise<void> {
  if (user.role !== "fielder") {
    if (
      !hasPermission(user.role, "projects:read") &&
      !hasPermission(user.role, "projects:write")
    ) {
      throw new ApiError("Forbidden", 403);
    }
    return;
  }

  if (!user.fielderId) throw new ApiError("Forbidden", 403);

  const assignment = await prisma.assignment.findFirst({
    where: { projectId, fielderId: user.fielderId },
    select: { id: true },
  });
  if (!assignment) throw new ApiError("Forbidden", 403);
}
