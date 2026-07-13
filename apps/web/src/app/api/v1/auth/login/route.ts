import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { loginSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { createToken, setSessionCookie } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid email or password", 400);
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      return jsonError("Invalid email or password", 401);
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return jsonError("Invalid email or password", 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const sessionUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      fielderId: user.fielderId,
    };

    const token = await createToken(sessionUser);
    const isMobile = request.headers.get("x-client") === "mobile";

    if (isMobile) {
      return jsonOk({
        accessToken: token,
        user: sessionUser,
      });
    }

    await setSessionCookie(token);
    return jsonOk({ user: sessionUser });
  } catch (error) {
    return handleApiError(error);
  }
}
