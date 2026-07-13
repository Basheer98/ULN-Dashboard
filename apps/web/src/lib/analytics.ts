import { prisma } from "./prisma";
import { toNumber, stateName, type DateRange, inDateRange } from "@uln/shared";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const WORKED_STATUSES = ["in_progress", "complete"];
const REVENUE_STATUSES = ["complete", "invoiced", "paid"];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function monthsInRange(range: DateRange) {
  const buckets: { key: string; label: string }[] = [];
  const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
  while (cursor <= range.to) {
    buckets.push({
      key: monthKey(cursor),
      label: `${MONTH_LABELS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  if (buckets.length === 0) {
    const now = new Date();
    buckets.push({ key: monthKey(now), label: MONTH_LABELS[now.getMonth()] });
  }
  return buckets.slice(-12);
}

export interface DashboardAnalytics {
  totals: {
    totalSqft: number;
    completedSqft: number;
    activeFielders: number;
    totalRevenue: number;
    totalPayout: number;
    margin: number;
    projectCount: number;
  };
  sqftByMonth: { month: string; sqft: number }[];
  financeByMonth: { month: string; revenue: number; payout: number; margin: number }[];
  projectsByStatus: { name: string; value: number }[];
  topFielders: { id: string; name: string; sqft: number; jobs: number }[];
  sqftByClient: { id: string; name: string; sqft: number }[];
  fielderMix: { name: string; value: number }[];
  sqftByJobType: { name: string; sqft: number }[];
  sqftByState: { code: string; name: string; sqft: number; revenue: number }[];
}

export interface AnalyticsFilters {
  state?: string;
  clientId?: string;
}

function assignmentSqft(projectSqft: number, assignedSqft: unknown): number {
  const sqft = toNumber(assignedSqft);
  return sqft > 0 ? sqft : projectSqft;
}

export async function getDashboardAnalytics(
  range?: DateRange,
  filters?: AnalyticsFilters
): Promise<DashboardAnalytics> {
  const [projects, fielders] = await Promise.all([
    prisma.project.findMany({
      include: {
        client: true,
        lineItems: true,
        assignments: { include: { fielder: true } },
      },
    }),
    prisma.fielder.findMany({ where: { isActive: true } }),
  ]);

  const filtered = projects.filter((p) => {
    if (range && !inDateRange(new Date(p.completedAt ?? p.createdAt), range)) return false;
    if (filters?.state && p.state !== filters.state) return false;
    if (filters?.clientId && p.clientId !== filters.clientId) return false;
    return true;
  });

  const months = monthsInRange(
    range ?? {
      from: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1),
      to: new Date(),
      preset: "month",
    }
  );

  const sqftMonthMap = new Map<string, number>();
  const revenueMonthMap = new Map<string, number>();
  const payoutMonthMap = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  const clientSqft = new Map<string, { id: string; sqft: number }>();
  const jobTypeSqft = new Map<string, number>();
  const stateStats = new Map<string, { sqft: number; revenue: number }>();
  const fielderStats = new Map<string, { id: string; name: string; sqft: number; jobs: number }>();

  let totalSqft = 0;
  let completedSqft = 0;
  let totalRevenue = 0;
  let totalPayout = 0;
  const workedFielderIds = new Set<string>();

  for (const p of filtered) {
    const sqft = toNumber(p.sqft);
    const clientRate = toNumber(p.clientSqftRate);
    totalSqft += sqft;
    statusCounts.set(p.status, (statusCounts.get(p.status) ?? 0) + 1);

    const clientEntry = clientSqft.get(p.clientId) ?? { id: p.clientId, sqft: 0 };
    clientEntry.sqft += sqft;
    clientSqft.set(p.clientId, clientEntry);

    const jobType = p.jobType?.trim() || "Unspecified";
    jobTypeSqft.set(jobType, (jobTypeSqft.get(jobType) ?? 0) + sqft);

    const clientExtras = p.lineItems
      .filter((l) => l.type === "client_billing")
      .reduce((s, l) => s + toNumber(l.amount), 0);
    const projectRevenue = sqft * clientRate + clientExtras;

    if (p.state) {
      const st = stateStats.get(p.state) ?? { sqft: 0, revenue: 0 };
      st.sqft += sqft;
      st.revenue += projectRevenue;
      stateStats.set(p.state, st);
    }

    const projectPayout = p.assignments.reduce((sum, a) => {
      const aSqft = assignmentSqft(sqft, a.assignedSqft);
      const fielderExtras = p.lineItems
        .filter((l) => l.type === "fielder_payout" && (l.fielderId === a.fielderId || !l.fielderId))
        .reduce((s, l) => s + toNumber(l.amount), 0);
      return sum + aSqft * toNumber(a.fielderSqftRate) + fielderExtras;
    }, 0);

    for (const a of p.assignments) {
      const aSqft = assignmentSqft(sqft, a.assignedSqft);
      const name = `${a.fielder.firstName} ${a.fielder.lastName}`;
      const entry = fielderStats.get(a.fielderId) ?? { id: a.fielderId, name, sqft: 0, jobs: 0 };
      entry.sqft += aSqft;
      entry.jobs += 1;
      fielderStats.set(a.fielderId, entry);
      if (WORKED_STATUSES.includes(a.status)) workedFielderIds.add(a.fielderId);
    }

    const bucketDate = p.completedAt ?? p.createdAt;
    const key = monthKey(new Date(bucketDate));

    if (p.status === "complete" || p.status === "invoiced" || p.status === "paid") {
      completedSqft += sqft;
      sqftMonthMap.set(key, (sqftMonthMap.get(key) ?? 0) + sqft);
    }

    if (REVENUE_STATUSES.includes(p.status)) {
      totalRevenue += projectRevenue;
      totalPayout += projectPayout;
      revenueMonthMap.set(key, (revenueMonthMap.get(key) ?? 0) + projectRevenue);
      payoutMonthMap.set(key, (payoutMonthMap.get(key) ?? 0) + projectPayout);
    }
  }

  return {
    totals: {
      totalSqft: Math.round(totalSqft),
      completedSqft: Math.round(completedSqft),
      activeFielders: workedFielderIds.size,
      totalRevenue: Math.round(totalRevenue),
      totalPayout: Math.round(totalPayout),
      margin: Math.round(totalRevenue - totalPayout),
      projectCount: filtered.length,
    },
    sqftByMonth: months.map((m) => ({ month: m.label, sqft: Math.round(sqftMonthMap.get(m.key) ?? 0) })),
    financeByMonth: months.map((m) => {
      const revenue = Math.round(revenueMonthMap.get(m.key) ?? 0);
      const payout = Math.round(payoutMonthMap.get(m.key) ?? 0);
      return { month: m.label, revenue, payout, margin: revenue - payout };
    }),
    projectsByStatus: Array.from(statusCounts.entries())
      .map(([name, value]) => ({
        name: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value,
      }))
      .sort((a, b) => b.value - a.value),
    topFielders: Array.from(fielderStats.values())
      .sort((a, b) => b.sqft - a.sqft)
      .slice(0, 8)
      .map((f) => ({ id: f.id, name: f.name, sqft: Math.round(f.sqft), jobs: f.jobs })),
    sqftByClient: Array.from(clientSqft.values())
      .map((c) => ({ id: c.id, name: projects.find((p) => p.clientId === c.id)?.client.name ?? c.id, sqft: Math.round(c.sqft) }))
      .sort((a, b) => b.sqft - a.sqft)
      .slice(0, 8),
    sqftByJobType: Array.from(jobTypeSqft.entries())
      .map(([name, sqft]) => ({ name, sqft: Math.round(sqft) }))
      .sort((a, b) => b.sqft - a.sqft),
    sqftByState: Array.from(stateStats.entries())
      .map(([code, v]) => ({ code, name: stateName(code), sqft: Math.round(v.sqft), revenue: Math.round(v.revenue) }))
      .sort((a, b) => b.sqft - a.sqft),
    fielderMix: [
      { name: "1099 Contractor", value: fielders.filter((f) => f.employmentType === "contractor_1099").length },
      { name: "W-2 Employee", value: fielders.filter((f) => f.employmentType === "w2").length },
    ].filter((d) => d.value > 0),
  };
}

export async function getFielderAnalytics(fielderId: string, range?: DateRange) {
  const assignments = await prisma.assignment.findMany({
    where: { fielderId },
    include: { project: { include: { client: true, lineItems: true } } },
  });

  let totalSqft = 0;
  let totalPay = 0;
  let completedJobs = 0;

  for (const a of assignments) {
    const p = a.project;
    const date = new Date(p.completedAt ?? p.createdAt);
    if (range && !inDateRange(date, range)) continue;

    const sqft = assignmentSqft(toNumber(p.sqft), a.assignedSqft);
    const rate = toNumber(a.fielderSqftRate);
    const extras = p.lineItems
      .filter((l) => l.type === "fielder_payout" && (l.fielderId === fielderId || !l.fielderId))
      .reduce((s, l) => s + toNumber(l.amount), 0);

    totalSqft += sqft;
    totalPay += sqft * rate + extras;
    if (a.status === "complete") completedJobs++;
  }

  return { totalSqft: Math.round(totalSqft), totalPay: Math.round(totalPay), completedJobs, assignmentCount: assignments.length };
}

export async function getClientAnalytics(clientId: string, range?: DateRange) {
  const projects = await prisma.project.findMany({
    where: { clientId },
    include: { lineItems: true },
  });

  let totalSqft = 0;
  let totalRevenue = 0;
  let projectCount = 0;

  for (const p of projects) {
    const date = new Date(p.completedAt ?? p.createdAt);
    if (range && !inDateRange(date, range)) continue;
    const sqft = toNumber(p.sqft);
    const extras = p.lineItems.filter((l) => l.type === "client_billing").reduce((s, l) => s + toNumber(l.amount), 0);
    totalSqft += sqft;
    totalRevenue += sqft * toNumber(p.clientSqftRate) + extras;
    projectCount++;
  }

  return { totalSqft: Math.round(totalSqft), totalRevenue: Math.round(totalRevenue), projectCount };
}
