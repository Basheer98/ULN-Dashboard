import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canAccessRoute } from "@uln/shared";
import { verifyToken } from "@/lib/auth";

const publicPaths = ["/login", "/api/v1/auth/login"];
const COOKIE_NAME = "uln_session";

function toLogin(request: NextRequest, clearCookie: boolean) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  if (clearCookie) response.cookies.delete(COOKIE_NAME);
  return response;
}

/**
 * Page access is decided here, before any server component runs. Checking in a layout
 * is not enough: Next renders the page alongside the layout, so a redirecting layout
 * still streams the page's data in the response body.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    publicPaths.some((path) => pathname === path) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.[a-z0-9]+$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return toLogin(request, false);

  const user = await verifyToken(token);
  if (!user || user.role === "fielder") return toLogin(request, true);

  if (pathname !== "/" && !canAccessRoute(user.role, pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image).*)"],
};
