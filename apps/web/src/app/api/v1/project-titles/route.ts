import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";

const createSchema = z.object({
  name: z.string().trim().min(1, "Title is required").max(120),
});

export async function GET(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "projects:read");
    const includeInactive = request.nextUrl.searchParams.get("inactive") === "1";

    const titles = await prisma.projectTitle.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: "asc" },
    });

    return jsonOk(titles);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "projects:write");
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const name = parsed.data.name.trim();
    const existing = await prisma.projectTitle.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      if (!existing.isActive) {
        const restored = await prisma.projectTitle.update({
          where: { id: existing.id },
          data: { isActive: true, name },
        });
        return jsonOk(restored);
      }
      return jsonError("Title already exists", 400);
    }

    const title = await prisma.projectTitle.create({
      data: { name },
    });
    return jsonOk(title, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
