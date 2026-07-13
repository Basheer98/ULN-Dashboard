import { prisma } from "./prisma";
import {
  calculateClientTotal,
  calculateFielderTotal,
  toNumber,
} from "@uln/shared";

export async function getProjectFinancials(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      lineItems: true,
      assignments: {
        include: { fielder: true },
      },
    },
  });

  const sqft = toNumber(project.sqft);
  const clientRate = toNumber(project.clientSqftRate);

  const clientLineItems = project.lineItems
    .filter((item) => item.type === "client_billing")
    .map((item) => ({ amount: toNumber(item.amount) }));

  const clientTotals = calculateClientTotal(sqft, clientRate, clientLineItems);

  const fielderBreakdown = project.assignments.map((assignment) => {
    const fielderRate = toNumber(assignment.fielderSqftRate);
    const assignedSqft = toNumber(assignment.assignedSqft) || sqft;
    const fielderLineItems = project.lineItems
      .filter(
        (item) =>
          item.type === "fielder_payout" &&
          (item.fielderId === assignment.fielderId || !item.fielderId)
      )
      .map((item) => ({ amount: toNumber(item.amount) }));

    const totals = calculateFielderTotal(assignedSqft, fielderRate, fielderLineItems);

    return {
      assignmentId: assignment.id,
      fielderId: assignment.fielderId,
      fielderName: `${assignment.fielder.firstName} ${assignment.fielder.lastName}`,
      employmentType: assignment.fielder.employmentType,
      fielderSqftRate: fielderRate,
      assignedSqft,
      ...totals,
    };
  });

  const totalFielderPay = fielderBreakdown.reduce((sum, f) => sum + f.total, 0);
  const margin = clientTotals.total - totalFielderPay;

  return {
    sqft,
    clientSqftRate: clientRate,
    client: clientTotals,
    fielders: fielderBreakdown,
    totalFielderPay,
    margin,
  };
}

export function serializeProject<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, val) =>
      typeof val === "object" && val !== null && "toFixed" in val
        ? Number(val)
        : val
    )
  ) as T;
}
