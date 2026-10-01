import { prisma } from "./prisma";

const WINDOW_MS = 15 * 60 * 1000;
export const MAX_EMAIL_FAILURES = 5;
export const MAX_IP_FAILURES = 20;

export type LoginFailureReason = "invalid_credentials" | "inactive" | "locked";

/** Seconds until the oldest counted failure falls out of the window. */
function retryAfterSeconds(failureTimes: Date[], limit: number, now: number): number {
  const newestFirst = [...failureTimes].sort((a, b) => b.getTime() - a.getTime());
  const oldestCounted = newestFirst[limit - 1];
  return Math.max(1, Math.ceil((oldestCounted.getTime() + WINDOW_MS - now) / 1000));
}

/**
 * Blocks an email after MAX_EMAIL_FAILURES failed logins in 15 minutes (reset by a
 * successful login) and an IP after MAX_IP_FAILURES. Blocked attempts are logged but
 * not counted, so an attacker can't keep a real user locked out indefinitely.
 */
export async function checkLoginAllowed(
  email: string,
  ipAddress: string | null
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const now = Date.now();
  const windowStart = new Date(now - WINDOW_MS);

  const lastSuccess = await prisma.loginAttempt.findFirst({
    where: { email, success: true, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const [emailFailures, ipFailures] = await Promise.all([
    prisma.loginAttempt.findMany({
      where: {
        email,
        success: false,
        reason: { not: "locked" },
        createdAt: { gt: lastSuccess?.createdAt ?? windowStart },
      },
      select: { createdAt: true },
    }),
    ipAddress
      ? prisma.loginAttempt.findMany({
          where: {
            ipAddress,
            success: false,
            reason: { not: "locked" },
            createdAt: { gte: windowStart },
          },
          select: { createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  if (emailFailures.length >= MAX_EMAIL_FAILURES) {
    return {
      allowed: false,
      retryAfterSeconds: retryAfterSeconds(
        emailFailures.map((f) => f.createdAt),
        MAX_EMAIL_FAILURES,
        now
      ),
    };
  }
  if (ipFailures.length >= MAX_IP_FAILURES) {
    return {
      allowed: false,
      retryAfterSeconds: retryAfterSeconds(
        ipFailures.map((f) => f.createdAt),
        MAX_IP_FAILURES,
        now
      ),
    };
  }
  return { allowed: true };
}

export async function recordLoginAttempt(
  email: string,
  ipAddress: string | null,
  success: boolean,
  reason?: LoginFailureReason
) {
  await prisma.loginAttempt.create({
    data: { email, ipAddress, success, reason: reason ?? null },
  });
}
