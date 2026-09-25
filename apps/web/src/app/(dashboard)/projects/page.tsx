import { Header } from "@/components/layout";
import { ProjectsFilter } from "@/components/projects-filter";
import { ProjectsTable, type ProjectRow } from "@/components/projects-table";
import { prisma } from "@/lib/prisma";
import { toNumber, stateName, hasPermission, canViewProjectFinancials } from "@uln/shared";
import type { Prisma, ProjectStatus } from "@uln/database";
import Link from "next/link";
import { buildProjectSearchWhere } from "@/lib/project-search";
import { getSessionUser } from "@/lib/auth";

function dayStart(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

function dayEnd(iso: string) {
  return new Date(`${iso}T23:59:59.999`);
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    state?: string;
    status?: string;
    qfield?: string;
    q?: string;
    title?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const canWrite = user ? hasPermission(user.role, "projects:write") : false;
  const canSeeMoney = user ? canViewProjectFinancials(user.role) : false;

  const where: Prisma.ProjectWhereInput = { deletedAt: null };
  if (params.state) where.state = params.state;
  if (params.status) where.status = params.status as ProjectStatus;
  if (params.qfield) where.qfield = Number(params.qfield);
  if (params.title?.trim()) {
    where.title = { equals: params.title.trim(), mode: "insensitive" };
  }
  if (params.q?.trim()) {
    Object.assign(where, buildProjectSearchWhere(params.q));
  }
  if (params.from || params.to) {
    const range: Prisma.DateTimeFilter = {};
    if (params.from) range.gte = dayStart(params.from);
    if (params.to) range.lte = dayEnd(params.to);
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { dueDate: range },
          { dueDate: null, createdAt: range },
        ],
      },
    ];
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      client: true,
      assignments: { include: { fielder: true } },
    },
  });

  const rows: ProjectRow[] = projects.map((project) => {
    const fielder = project.assignments[0]?.fielder;
    return {
      id: project.id,
      projectNumber: project.projectNumber,
      title: project.title,
      clientName: project.client.name,
      state: stateName(project.state),
      qfield: project.qfield,
      sqft: toNumber(project.sqft),
      buriedSqft: project.buriedSqft != null ? toNumber(project.buriedSqft) : null,
      aerialSqft: project.aerialSqft != null ? toNumber(project.aerialSqft) : null,
      clientBill: canSeeMoney
        ? toNumber(project.sqft) * toNumber(project.clientSqftRate)
        : 0,
      dueDate: project.dueDate?.toISOString() ?? null,
      fielderName: fielder ? `${fielder.firstName} ${fielder.lastName}` : null,
      status: project.status,
    };
  });

  return (
    <>
      <Header
        title="Projects"
        subtitle={
          canSeeMoney
            ? "Track jobs, SQFT billing, and assignments"
            : "Track jobs and assignments"
        }
      />
      <main className="page-main space-y-6">
        <div className="page-toolbar">
          <ProjectsFilter />
          {canWrite && (
            <div className="page-toolbar-actions">
              <Link href="/projects/deleted" className="btn-secondary">
                Deleted
              </Link>
              <Link href="/projects/import" className="btn-secondary">
                Import from Sheet
              </Link>
              <Link href="/projects/new" className="btn-primary">
                New Project
              </Link>
            </div>
          )}
        </div>
        <ProjectsTable projects={rows} canSeeMoney={canSeeMoney} />
      </main>
    </>
  );
}
