import { redirect } from "next/navigation";
import { canAccessRoute } from "@uln/shared";
import { getSessionUser, type SessionUser } from "./auth";

/**
 * Server-side route check for section layouts, so a page's data is never rendered
 * for a role that can't open it (the client RouteGuard only redirects after load).
 */
export async function requirePageAccess(path: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canAccessRoute(user.role, path)) redirect("/dashboard");
  return user;
}
