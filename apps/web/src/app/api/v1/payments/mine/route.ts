import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireUser } from "@/lib/api";
import { serializeProject } from "@/lib/projects";

export async function GET(request: NextRequest) {
  try {
    const user = requireUser(await getRequestUser(request));
    if (user.role !== "fielder" || !user.fielderId) {
      return jsonError("Forbidden", 403);
    }

    const payments = await prisma.fielderPayment.findMany({
      where: { fielderId: user.fielderId },
      orderBy: { createdAt: "desc" },
      include: {
        project: {
          select: { projectNumber: true, title: true, state: true, sqft: true },
        },
      },
    });

    return jsonOk(serializeProject(payments));
  } catch (error) {
    return handleApiError(error);
  }
}
