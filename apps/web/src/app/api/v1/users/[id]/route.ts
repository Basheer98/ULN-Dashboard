import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { serializeProject } from "@/lib/projects";

const updateSchema = z.object({
  role: z.enum(["admin", "dispatcher", "accountant"]).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePermission(await getRequestUser(request), "users:write");
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    const data: Record<string, unknown> = { ...parsed.data };
    delete data.password;
    if (parsed.data.password) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, role: true, firstName: true, lastName: true, isActive: true,
      },
    });
    return jsonOk(serializeProject(user));
  } catch (error) {
    return handleApiError(error);
  }
}
