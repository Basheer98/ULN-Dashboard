import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePermission(await getRequestUser(request), "projects:write");
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const existing = await prisma.projectTitle.findUnique({ where: { id } });
    if (!existing) return jsonError("Title not found", 404);

    if (parsed.data.name) {
      const clash = await prisma.projectTitle.findFirst({
        where: {
          id: { not: id },
          name: { equals: parsed.data.name.trim(), mode: "insensitive" },
        },
      });
      if (clash) return jsonError("Title already exists", 400);
    }

    const title = await prisma.projectTitle.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    });

    return jsonOk(title);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePermission(await getRequestUser(request), "projects:write");
    const { id } = await params;

    const existing = await prisma.projectTitle.findUnique({ where: { id } });
    if (!existing) return jsonError("Title not found", 404);

    const title = await prisma.projectTitle.update({
      where: { id },
      data: { isActive: false },
    });

    return jsonOk(title);
  } catch (error) {
    return handleApiError(error);
  }
}
