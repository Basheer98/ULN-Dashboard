import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@uln/shared";
import { prisma } from "@/lib/prisma";
import { createSession, getClientIp, setSessionCookie } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { checkLoginAllowed, recordLoginAttempt } from "@/lib/login-guard";

let dummyHash: string | null = null;

/** Compare against a throwaway hash so unknown emails take as long as wrong passwords. */
async function burnPasswordCheck(password: string) {
  dummyHash ??= await bcrypt.hash("uln-timing-equalizer", 12);
  await bcrypt.compare(password, dummyHash);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid email or password", 400);
    }

    const email = parsed.data.email.trim().toLowerCase();
    const ipAddress = getClientIp(request);

    const guard = await checkLoginAllowed(email, ipAddress);
    if (!guard.allowed) {
      await recordLoginAttempt(email, ipAddress, false, "locked");
      const minutes = Math.ceil(guard.retryAfterSeconds / 60);
      return NextResponse.json(
        {
          error: `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        },
        { status: 429, headers: { "Retry-After": String(guard.retryAfterSeconds) } }
      );
    }

    const user =
      (await prisma.user.findUnique({
        where: { email },
        include: { fielder: { select: { isActive: true } } },
      })) ??
      (await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        include: { fielder: { select: { isActive: true } } },
      }));

    if (!user) {
      await burnPasswordCheck(parsed.data.password);
      await recordLoginAttempt(email, ipAddress, false, "invalid_credentials");
      return jsonError("Invalid email or password", 401);
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      await recordLoginAttempt(email, ipAddress, false, "invalid_credentials");
      return jsonError("Invalid email or password", 401);
    }

    const fielderInactive = user.role === "fielder" && user.fielder && !user.fielder.isActive;
    if (!user.isActive || fielderInactive) {
      await recordLoginAttempt(email, ipAddress, false, "inactive");
      return jsonError("Invalid email or password", 401);
    }

    const isMobile = request.headers.get("x-client") === "mobile";
    if (isMobile && user.role === "coordinator") {
      return jsonError("Project coordinator accounts sign in on the web dashboard, not the mobile app.", 403);
    }

    await Promise.all([
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      recordLoginAttempt(email, ipAddress, true),
    ]);

    const sessionUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      fielderId: user.fielderId,
    };

    const token = await createSession(sessionUser, request, isMobile ? "mobile" : "web");

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
