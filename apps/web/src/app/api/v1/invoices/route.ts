import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { serializeProject } from "@/lib/projects";
import { createInvoiceFromProject } from "@/lib/finance";
import { toNumber } from "@uln/shared";

export async function GET(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "invoices:read");
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, project: true },
    });
    return jsonOk(serializeProject(invoices));
  } catch (error) {
    return handleApiError(error);
  }
}

const generateSchema = z.object({ projectId: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "invoices:write");
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) return jsonError("projectId required", 400);

    const invoice = await createInvoiceFromProject(parsed.data.projectId);
    return jsonOk(serializeProject(invoice), 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("complete")) {
      return jsonError(error.message, 400);
    }
    return handleApiError(error);
  }
}
