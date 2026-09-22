import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonOk, requirePermission } from "@/lib/api";

/** Managed active titles ∪ distinct project titles (deduped) for dropdowns / filters. */
export async function GET(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "projects:read");

    const [managed, rows] = await Promise.all([
      prisma.projectTitle.findMany({
        where: { isActive: true },
        select: { name: true },
        orderBy: { name: "asc" },
      }),
      prisma.project.findMany({
        where: {
          deletedAt: null,
          title: { not: "" },
        },
        select: { title: true },
        distinct: ["title"],
        orderBy: { title: "asc" },
      }),
    ]);

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const name of [
      ...managed.map((t) => t.name.trim()),
      ...rows.map((r) => r.title.trim()),
    ]) {
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(name);
    }

    unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    return jsonOk({ titles: unique });
  } catch (error) {
    return handleApiError(error);
  }
}
