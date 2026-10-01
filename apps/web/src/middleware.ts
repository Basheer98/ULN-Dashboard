import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/api/v1/auth/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    publicPaths.some((path) => pathname === path) ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/v1")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("uln_session")?.value;
  // Only a cheap presence check here; the session itself is validated against the
  // database by the dashboard layout, which sends revoked or expired sessions to /login.
  if (!token && !pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
