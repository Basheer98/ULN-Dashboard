import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { serializeProject } from "@/lib/projects";

const updateSchema = z.object({
  status: z.enum(["draft", "sent", "partial", "paid", "overdue"]).optional(),
  notes: z.string().optional(),
  paidAt: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePermission(await getRequestUser(request), "invoices:write");
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid input", 400);

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.status === "sent" && !data.issuedAt) {
      data.issuedAt = new Date();
    }
    if (parsed.data.status === "paid") {
      data.paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();
      const existing = await prisma.invoice.findUnique({ where: { id } });
      if (existing) {
        await prisma.project.update({
          where: { id: existing.projectId },
          data: { status: "paid" },
        });
      }
    }
    if (parsed.data.paidAt) data.paidAt = new Date(parsed.data.paidAt);

    const invoice = await prisma.invoice.update({
      where: { id },
      data,
      include: { client: true, project: true },
    });

    return jsonOk(serializeProject(invoice));
  } catch (error) {
    return handleApiError(error);
  }
}
