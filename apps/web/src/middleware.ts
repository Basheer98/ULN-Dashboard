import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/api/health", "/api/v1/auth/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    publicPaths.some((path) => pathname === path) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/v1")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("uln_session")?.value;
  if (!token && !pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
