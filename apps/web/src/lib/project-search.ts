import type { Prisma } from "@uln/database";

export function buildProjectSearchWhere(query: string): Prisma.ProjectWhereInput {
  const term = query.trim();
  if (!term) return {};

  return {
    OR: [
      { projectNumber: { contains: term, mode: "insensitive" } },
      { title: { contains: term, mode: "insensitive" } },
      { siteAddress: { contains: term, mode: "insensitive" } },
      { city: { contains: term, mode: "insensitive" } },
      { zip: { contains: term, mode: "insensitive" } },
      { jobType: { contains: term, mode: "insensitive" } },
      { client: { name: { contains: term, mode: "insensitive" } } },
    ],
  };
}

export type ProjectSearchResult = {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  clientName: string;
  siteAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  dueDate: string | null;
  fielders: string[];
  assignmentId: string | null;
};

export function mapProjectToSearchResult(
  project: {
    id: string;
    projectNumber: string;
    title: string;
    status: string;
    siteAddress: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    dueDate: Date | null;
    client: { name: string };
    assignments: Array<{
      id: string;
      fielder: { firstName: string; lastName: string };
    }>;
  },
  assignmentId: string | null = null
): ProjectSearchResult {
  return {
    id: project.id,
    projectNumber: project.projectNumber,
    title: project.title,
    status: project.status,
    clientName: project.client.name,
    siteAddress: project.siteAddress,
    city: project.city,
    state: project.state,
    zip: project.zip,
    dueDate: project.dueDate?.toISOString() ?? null,
    fielders: project.assignments.map(
      (assignment) => `${assignment.fielder.firstName} ${assignment.fielder.lastName}`
    ),
    assignmentId,
  };
}
