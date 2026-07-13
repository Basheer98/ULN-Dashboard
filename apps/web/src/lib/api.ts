import { NextResponse } from "next/server";
import type { SessionUser } from "./auth";
import { hasPermission, type Permission } from "@uln/shared";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function requireUser(user: SessionUser | null): SessionUser {
  if (!user) {
    throw new ApiError("Unauthorized", 401);
  }
  return user;
}

export function requireOfficeUser(user: SessionUser | null): SessionUser {
  const session = requireUser(user);
  if (session.role === "fielder") {
    throw new ApiError("Forbidden", 403);
  }
  return session;
}

export function requirePermission(user: SessionUser | null, permission: Permission): SessionUser {
  const session = requireUser(user);
  if (!hasPermission(session.role, permission)) {
    throw new ApiError("Forbidden", 403);
  }
  return session;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return jsonError(error.message, error.status);
  }
  console.error(error);
  return jsonError("Internal server error", 500);
}

export async function generateProjectNumber(): Promise<string> {
  const { prisma } = await import("./prisma");
  const year = new Date().getFullYear();
  const prefix = `ULN-${year}-`;
  const latest = await prisma.project.findFirst({
    where: { projectNumber: { startsWith: prefix } },
    orderBy: { projectNumber: "desc" },
  });

  if (!latest) return `${prefix}001`;

  const lastNum = parseInt(latest.projectNumber.replace(prefix, ""), 10);
  const next = (lastNum + 1).toString().padStart(3, "0");
  return `${prefix}${next}`;
}

export async function generateInvoiceNumber(): Promise<string> {
  const { prisma } = await import("./prisma");
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const latest = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
  });

  if (!latest) return `${prefix}001`;

  const lastNum = parseInt(latest.invoiceNumber.replace(prefix, ""), 10);
  const next = (lastNum + 1).toString().padStart(3, "0");
  return `${prefix}${next}`;
}
