import { Header, StatusBadge } from "@/components/layout";
import { ProjectsFilter } from "@/components/projects-filter";
import { prisma } from "@/lib/prisma";
import { formatCurrency, toNumber, stateName } from "@uln/shared";
import type { Prisma, ProjectStatus } from "@uln/database";
import Link from "next/link";
import { buildProjectSearchWhere } from "@/lib/project-search";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; status?: string; qfield?: string; q?: string }>;
}) {
  const params = await searchParams;

  const where: Prisma.ProjectWhereInput = {};
  if (params.state) where.state = params.state;
  if (params.status) where.status = params.status as ProjectStatus;
  if (params.qfield) where.qfield = Number(params.qfield);
  if (params.q?.trim()) {
    Object.assign(where, buildProjectSearchWhere(params.q));
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      client: true,
      assignments: { include: { fielder: true } },
    },
  });

  return (
    <>
      <Header title="Projects" subtitle="Track jobs, SQFT billing, and assignments" />
      <main className="page-main space-y-6">
        <div className="page-toolbar">
          <ProjectsFilter />
          <div className="page-toolbar-actions">
            <Link href="/projects/import" className="btn-secondary">
              Import from Sheet
            </Link>
            <Link href="/projects/new" className="btn-primary">
              New Project
            </Link>
          </div>
        </div>
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>State</th>
                <th>QField</th>
                <th>SQFT</th>
                <th>Client Bill</th>
                <th>ECD</th>
                <th>Fielder</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-sm text-muted-foreground">
                    No projects match these filters.
                  </td>
                </tr>
              ) : (
                projects.map((project) => {
                  const bill = toNumber(project.sqft) * toNumber(project.clientSqftRate);
                  const fielder = project.assignments[0]?.fielder;
                  return (
                    <tr key={project.id}>
                      <td>
                        <Link href={`/projects/${project.id}`} className="link">
                          {project.projectNumber}
                        </Link>
                        <p className="text-xs text-muted-foreground">{project.title}</p>
                      </td>
                      <td>{project.client.name}</td>
                      <td>{stateName(project.state)}</td>
                      <td>{project.qfield ? `QField ${project.qfield}` : "—"}</td>
                      <td>{toNumber(project.sqft).toLocaleString()}</td>
                      <td>{formatCurrency(bill)}</td>
                      <td>{project.dueDate ? project.dueDate.toLocaleDateString() : "—"}</td>
                      <td>{fielder ? `${fielder.firstName} ${fielder.lastName}` : "—"}</td>
                      <td><StatusBadge status={project.status} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
