import { Header, StatusBadge } from "@/components/layout";
import { ProjectRestoreButton } from "@/components/project-restore-button";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatCurrency, hasPermission, toNumber } from "@uln/shared";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DeletedProjectsPage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "projects:write")) {
    redirect("/projects");
  }

  const projects = await prisma.project.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    include: {
      client: true,
      assignments: { include: { fielder: true } },
    },
  });

  return (
    <>
      <Header
        title="Deleted Projects"
        subtitle="Soft-deleted projects — restore to bring them and cascaded expenses back"
      />
      <main className="page-main space-y-6">
        <div className="page-toolbar">
          <Link href="/projects" className="btn-secondary">
            ← Back to projects
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="card text-center text-sm text-muted-foreground">
            No deleted projects.
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Client</th>
                  <th>SQFT</th>
                  <th>Deleted</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <p className="font-medium">{project.projectNumber}</p>
                      <p className="text-xs text-muted-foreground">{project.title}</p>
                    </td>
                    <td>{project.client.name}</td>
                    <td>
                      {toNumber(project.sqft).toLocaleString()}
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(
                          toNumber(project.sqft) * toNumber(project.clientSqftRate)
                        )}
                      </p>
                    </td>
                    <td>
                      {project.deletedAt
                        ? project.deletedAt.toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td>
                      <StatusBadge status={project.status} />
                    </td>
                    <td>
                      <ProjectRestoreButton
                        projectId={project.id}
                        projectNumber={project.projectNumber}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
