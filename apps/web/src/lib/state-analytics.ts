import { prisma } from "./prisma";
import { toNumber, stateName, inDateRange, type DateRange } from "@uln/shared";

export async function getStateAnalytics(stateCode: string, range?: DateRange) {
  const projects = await prisma.project.findMany({
    where: { deletedAt: null, state: stateCode },
    include: {
      client: true,
      lineItems: true,
      assignments: { include: { fielder: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const filtered = range
    ? projects.filter((p) => inDateRange(new Date(p.completedAt ?? p.createdAt), range))
    : projects;

  let totalSqft = 0;
  let completedSqft = 0;
  let totalRevenue = 0;
  let totalPayout = 0;
  let activeProjects = 0;

  for (const p of filtered) {
    const sqft = toNumber(p.sqft);
    const clientRate = toNumber(p.clientSqftRate);
    const clientExtras = p.lineItems
      .filter((l) => l.type === "client_billing")
      .reduce((s, l) => s + toNumber(l.amount), 0);
    const revenue = sqft * clientRate + clientExtras;

    const payout = p.assignments.reduce((sum, a) => {
      const aSqft = toNumber(a.assignedSqft) || sqft;
      const extras = p.lineItems
        .filter((l) => l.type === "fielder_payout" && (l.fielderId === a.fielderId || !l.fielderId))
        .reduce((s, l) => s + toNumber(l.amount), 0);
      return sum + aSqft * toNumber(a.fielderSqftRate) + extras;
    }, 0);

    totalSqft += sqft;
    totalRevenue += revenue;
    totalPayout += payout;

    if (["complete", "invoiced", "paid"].includes(p.status)) {
      completedSqft += sqft;
    }
    if (["assigned", "in_progress", "draft"].includes(p.status)) {
      activeProjects++;
    }
  }

  return {
    stateCode,
    stateName: stateName(stateCode),
    projectCount: filtered.length,
    activeProjects,
    totalSqft: Math.round(totalSqft),
    completedSqft: Math.round(completedSqft),
    totalRevenue: Math.round(totalRevenue),
    totalPayout: Math.round(totalPayout),
    margin: Math.round(totalRevenue - totalPayout),
    projects: filtered,
  };
}
