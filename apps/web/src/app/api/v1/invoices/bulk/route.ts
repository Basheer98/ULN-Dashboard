import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  action: z.enum(["mark_sent"]),
});

export async function POST(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "invoices:write");
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const { ids, action } = parsed.data;

    if (action === "mark_sent") {
      const drafts = await prisma.invoice.findMany({
        where: { id: { in: ids }, deletedAt: null, status: "draft" },
        select: { id: true, issuedAt: true },
      });

      if (drafts.length > 0) {
        await prisma.$transaction(
          drafts.map((inv) =>
            prisma.invoice.update({
              where: { id: inv.id },
              data: {
                status: "sent",
                issuedAt: inv.issuedAt ?? new Date(),
              },
            })
          )
        );
      }

      return jsonOk({ updated: drafts.length });
    }

    return jsonError("Unknown action", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
