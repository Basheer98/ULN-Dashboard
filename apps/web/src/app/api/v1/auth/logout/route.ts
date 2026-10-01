import { NextRequest } from "next/server";
import { clearSessionCookie, getRequestUser, revokeSession } from "@/lib/auth";
import { jsonOk } from "@/lib/api";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (user?.sessionId) {
    await revokeSession(user.sessionId);
  }
  await clearSessionCookie();
  return jsonOk({ success: true });
}
