import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import type { UserRole } from "@uln/database";

const COOKIE_NAME = "uln_session";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  fielderId: string | null;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    role: user.role,
    fielderId: user.fielderId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return {
      id: payload.id as string,
      email: payload.email as string,
      role: payload.role as UserRole,
      fielderId: (payload.fielderId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
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
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return verifyToken(authHeader.slice(7));
  }

  const cookieToken = request.cookies.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    return verifyToken(cookieToken);
  }

  return null;
}

export function isOfficeRole(role: UserRole): boolean {
  return role === "admin" || role === "dispatcher" || role === "accountant";
}
