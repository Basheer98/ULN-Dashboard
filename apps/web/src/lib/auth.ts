import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { cache } from "react";
import type { UserRole } from "@uln/database";
import { BACKGROUND_REQUEST_HEADER, SESSION_IDLE_TIMEOUT_MS } from "@uln/shared";
import { prisma } from "./prisma";

const COOKIE_NAME = "uln_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  fielderId: string | null;
  sessionId?: string;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

/** Creates a revocable session row and returns a signed token that references it. */
export async function createSession(
  user: SessionUser,
  request: NextRequest,
  client: "web" | "mobile"
): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      client,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      expiresAt,
    },
  });

  return new SignJWT({
    sid: session.id,
    id: user.id,
    email: user.email,
    role: user.role,
    fielderId: user.fielderId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getJwtSecret());
}

/** Skip writing lastSeenAt on every request; once a minute is precise enough. */
const LAST_SEEN_WRITE_INTERVAL_MS = 60 * 1000;
/**
 * lastSeenAt can trail real activity by the write interval plus the client's one-minute
 * keepalive, so the server waits that long past the timeout before ending the session.
 */
const SERVER_IDLE_LIMIT_MS = SESSION_IDLE_TIMEOUT_MS + 2 * 60 * 1000;

/**
 * Role, active status and revocation come from the database on every request,
 * so deactivating a user or changing their role takes effect immediately.
 */
const loadSessionUser = cache(async (sessionId: string, countsAsActivity: boolean): Promise<SessionUser | null> => {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          fielderId: true,
          isActive: true,
          fielder: { select: { isActive: true } },
        },
      },
    },
  });
  const now = Date.now();
  if (!session || session.revokedAt || session.expiresAt.getTime() <= now) return null;

  const { user } = session;
  if (!user.isActive) return null;
  if (user.role === "fielder" && user.fielder && !user.fielder.isActive) return null;

  const idleMs = now - session.lastSeenAt.getTime();
  if (session.client === "web" && idleMs > SERVER_IDLE_LIMIT_MS) {
    await revokeSession(session.id);
    return null;
  }
  if (countsAsActivity && idleMs > LAST_SEEN_WRITE_INTERVAL_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } });
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fielderId: user.fielderId,
    sessionId: session.id,
  };
});

export async function verifyToken(token: string, countsAsActivity = true): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (typeof payload.sid !== "string") return null;
    return await loadSessionUser(payload.sid, countsAsActivity);
  } catch {
    return null;
  }
}

export async function revokeSession(sessionId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeUserSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getRequestUser(request: NextRequest): Promise<SessionUser | null> {
  const countsAsActivity = request.headers.get(BACKGROUND_REQUEST_HEADER) !== "1";
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return verifyToken(authHeader.slice(7), countsAsActivity);
  }

  const cookieToken = request.cookies.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    return verifyToken(cookieToken, countsAsActivity);
  }

  return null;
}

export { isOfficeRole } from "@uln/shared";
