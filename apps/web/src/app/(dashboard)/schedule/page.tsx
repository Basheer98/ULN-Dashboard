import { Header } from "@/components/layout";
import { ScheduleCalendar } from "@/components/schedule-calendar";
import { prisma } from "@/lib/prisma";
import { serializeProject } from "@/lib/projects";

export default async function SchedulePage() {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 7);
  const toDate = new Date();
  toDate.setDate(toDate.getDate() + 30);

  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      dueDate: { gte: fromDate, lte: toDate },
      status: { notIn: ["cancelled", "paid"] },
    },
    include: {
      client: true,
      assignments: { include: { fielder: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const data = serializeProject(projects) as Parameters<typeof ScheduleCalendar>[0]["projects"];

  return (
    <>
      <Header title="Schedule" subtitle="Dispatch calendar — jobs by ECD (estimated completion date)" />
      <main className="page-main">
        <ScheduleCalendar projects={data} />
      </main>
    </>
  );
}
