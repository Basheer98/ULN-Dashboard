import { toNumber } from "@uln/shared";
import { prisma } from "./prisma";

const FINANCE_ROLES = new Set(["admin", "accountant"]);
const LOGIN_HISTORY_LIMIT = 25;
const TIMELINE_LIMIT = 40;

export type TimelineEntry = {
  id: string;
  at: Date;
  kind: "activity" | "finance";
  text: string;
  href: string | null;
};

type ActivityMeta = {
  projectNumber?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  summary?: string;
};

function humanize(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replace(/_/g, " ");
}

function describeActivity(row: {
  entityType: string;
  entityId: string;
  action: string;
  metadata: unknown;
}): { text: string; href: string | null } {
  const meta = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as ActivityMeta;

  if (row.entityType === "project") {
    const label = meta.projectNumber ? `project ${meta.projectNumber}` : "a project";
    const href = row.action === "deleted" ? null : `/projects/${row.entityId}`;
    if (row.action === "updated" && meta.changes) {
      const status = meta.changes.status;
      if (status) {
        return { text: `Changed ${label} status: ${humanize(status.from)} → ${humanize(status.to)}`, href };
      }
      const fields = Object.keys(meta.changes).map(humanize).slice(0, 4).join(", ");
      return { text: `Edited ${label}${fields ? ` (${fields})` : ""}`, href };
    }
    if (row.action === "updated" && meta.summary) {
      return { text: `${meta.summary.replace(/ by .+$/, "")} on ${label}`, href };
    }
    return { text: `${humanize(row.action).replace(/^./, (c) => c.toUpperCase())} ${label}`, href };
  }

  const fallback = meta.summary || `${humanize(row.action)} ${humanize(row.entityType)}`;
  return { text: fallback.replace(/^./, (c) => c.toUpperCase()), href: null };
}

function describeFinanceAudit(row: { action: string; entityType: string }) {
  const action = humanize(row.action);
  return `${action.replace(/^./, (c) => c.toUpperCase())} ${humanize(row.entityType)}`;
}

function startOfMonthUtc(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export async function getTeamMemberProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!user || user.role === "fielder") return null;

  const now = new Date();
  const monthStart = startOfMonthUtc(now);
  const showFinance = FINANCE_ROLES.has(user.role);

  const [
    sessions,
    loginAttempts,
    projectsCreatedTotal,
    projectsCreatedThisMonth,
    recentProjects,
    uploadsTotal,
    statusChangeRows,
    activity,
  ] = await Promise.all([
    prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: { id: true, client: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true },
    }),
    prisma.loginAttempt.findMany({
      where: { email: user.email },
      orderBy: { createdAt: "desc" },
      take: LOGIN_HISTORY_LIMIT,
      select: { id: true, success: true, reason: true, ipAddress: true, createdAt: true },
    }),
    prisma.project.count({ where: { createdById: userId } }),
    prisma.project.count({ where: { createdById: userId, createdAt: { gte: monthStart } } }),
    prisma.project.findMany({
      where: { createdById: userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        projectNumber: true,
        title: true,
        status: true,
        createdAt: true,
        client: { select: { name: true } },
      },
    }),
    prisma.attachment.count({ where: { uploadedById: userId } }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count FROM activity_logs
      WHERE user_id = ${userId}
        AND entity_type = 'project'
        AND jsonb_exists(metadata->'changes', 'status')`,
    prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: TIMELINE_LIMIT,
      select: { id: true, entityType: true, entityId: true, action: true, metadata: true, createdAt: true },
    }),
  ]);

  let finance: {
    expensesCreated: number;
    expensesCreatedAmount: number;
    expensesReviewed: number;
    receiptsUploaded: number;
    fielderPaymentsRecorded: number;
    fielderPaymentsAmount: number;
  } | null = null;
  let financeAudit: { id: string; action: string; entityType: string; createdAt: Date }[] = [];

  if (showFinance) {
    const [created, reviewed, receipts, payments, audit] = await Promise.all([
      prisma.financialTransaction.aggregate({
        where: { createdById: userId, deletedAt: null, transactionType: "expense" },
        _count: true,
        _sum: { amount: true },
      }),
      prisma.financialTransaction.count({ where: { reviewedById: userId, deletedAt: null } }),
      prisma.receipt.count({ where: { uploadedById: userId, deletedAt: null } }),
      prisma.fielderPaymentEvent.aggregate({
        where: { createdById: userId },
        _count: true,
        _sum: { amount: true },
      }),
      prisma.financialAuditLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: TIMELINE_LIMIT,
        select: { id: true, action: true, entityType: true, createdAt: true },
      }),
    ]);
    finance = {
      expensesCreated: created._count,
      expensesCreatedAmount: toNumber(created._sum.amount ?? 0),
      expensesReviewed: reviewed,
      receiptsUploaded: receipts,
      fielderPaymentsRecorded: payments._count,
      fielderPaymentsAmount: toNumber(payments._sum.amount ?? 0),
    };
    financeAudit = audit;
  }

  const timeline: TimelineEntry[] = [
    ...activity.map((row) => ({
      id: `a-${row.id}`,
      at: row.createdAt,
      kind: "activity" as const,
      ...describeActivity(row),
    })),
    ...financeAudit.map((row) => ({
      id: `f-${row.id}`,
      at: row.createdAt,
      kind: "finance" as const,
      text: describeFinanceAudit(row),
      href: null,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, TIMELINE_LIMIT);

  const recentFailures = loginAttempts.filter(
    (a) => !a.success && a.createdAt.getTime() > now.getTime() - 24 * 60 * 60 * 1000
  ).length;

  return {
    user,
    sessions,
    loginAttempts,
    recentFailures,
    work: {
      projectsCreatedTotal,
      projectsCreatedThisMonth,
      statusChanges: Number(statusChangeRows[0]?.count ?? 0),
      uploadsTotal,
      recentProjects,
    },
    finance,
    timeline,
  };
}

export type TeamMemberProfile = NonNullable<Awaited<ReturnType<typeof getTeamMemberProfile>>>;

/** "Chrome on macOS" style label from a user-agent string. */
export function describeDevice(userAgent: string | null, client: string) {
  if (client === "mobile") return "ULN mobile app";
  if (!userAgent) return "Unknown browser";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : /curl\//.test(userAgent)
            ? "Command line"
            : "Browser";
  const os = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Mac OS X|Macintosh/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;
  return os ? `${browser} on ${os}` : browser;
}
