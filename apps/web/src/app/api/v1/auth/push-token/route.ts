import { NextRequest } from "next/server";
import { pushTokenSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireUser } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const user = requireUser(await getRequestUser(request));
    const body = await request.json();
    const parsed = pushTokenSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid push token", 400);

    await prisma.user.update({
      where: { id: user.id },
      data: { pushToken: parsed.data.pushToken },
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
