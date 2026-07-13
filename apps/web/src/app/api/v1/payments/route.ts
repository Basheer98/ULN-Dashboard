import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";
import { serializeProject } from "@/lib/projects";
import { createPaymentsFromProject } from "@/lib/finance";

export async function GET(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "payments:read");
    const payments = await prisma.fielderPayment.findMany({
      orderBy: { createdAt: "desc" },
      include: { fielder: true, project: true },
    });
    return jsonOk(serializeProject(payments));
  } catch (error) {
    return handleApiError(error);
  }
}

const generateSchema = z.object({ projectId: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    requirePermission(await getRequestUser(request), "payments:write");
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) return jsonError("projectId required", 400);

    const payments = await createPaymentsFromProject(parsed.data.projectId);
    return jsonOk(serializeProject(payments), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
