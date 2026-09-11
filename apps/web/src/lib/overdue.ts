import { prisma } from "./prisma";
import { markOverdueInvoices } from "./finance";

export async function getOverdueItems() {
  await markOverdueInvoices();
  const now = new Date();

  const [overdueInvoices, overdueProjects] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "overdue" },
      include: { client: true, project: true },
      orderBy: { dueAt: "asc" },
    }),
    prisma.project.findMany({
      where: {
        deletedAt: null,
        dueDate: { lt: now },
        status: { in: ["draft", "assigned", "in_progress"] },
      },
      include: { client: true, assignments: { include: { fielder: true } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  return { overdueInvoices, overdueProjects };
}
