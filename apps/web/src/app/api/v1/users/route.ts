import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { userSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { serializeProject } from "@/lib/projects";

export async function GET(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "users:read");
    const users = await prisma.user.findMany({
      where: { role: { not: "fielder" } },
      select: {
        id: true, email: true, role: true, firstName: true, lastName: true,
        isActive: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk(serializeProject(users));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "users:write");
    const body = await request.json();
    const parsed = userSchema.safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Invalid input", 400);
    if (!parsed.data.password) return jsonError("Password required for new users", 400);

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return jsonError("Email already in use", 400);

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        role: parsed.data.role,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        isActive: parsed.data.isActive ?? true,
      },
      select: {
        id: true, email: true, role: true, firstName: true, lastName: true, isActive: true,
      },
    });
    return jsonOk(user, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
