import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requirePermission } from "@/lib/api";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ state: string }> }
) {
  try {
    requirePermission(await getRequestUser(request), "rates:write");
    const { state } = await params;
    await prisma.stateRate.delete({ where: { state: state.toUpperCase() } });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
