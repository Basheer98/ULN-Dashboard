import { Header, StatusBadge } from "@/components/layout";
import { ProjectActions } from "@/components/project-actions";
import { ProjectAttachments } from "@/components/project-attachments";
import { GenerateInvoiceButton, GeneratePaymentsButton } from "@/components/finance-actions";
import { prisma } from "@/lib/prisma";
import { getProjectFinancials, serializeProject } from "@/lib/projects";
import { formatCurrency, toNumber } from "@uln/shared";
import { notFound } from "next/navigation";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      lineItems: { include: { fielder: true } },
      assignments: { include: { fielder: true } },
    },
  });

  if (!project) notFound();

  const financials = await getProjectFinancials(id);
  const fielders = await prisma.fielder.findMany({
    where: { isActive: true },
    orderBy: { lastName: "asc" },
  });

  const data = serializeProject(project);

  const projectForActions = {
    id: data.id,
    status: data.status,
    assignments: data.assignments.map((a: typeof data.assignments[number]) => ({
      id: a.id,
      fielderId: a.fielderId,
      fielderSqftRate: toNumber(a.fielderSqftRate),
      assignedSqft: toNumber(a.assignedSqft),
      status: a.status,
      fielder: { firstName: a.fielder.firstName, lastName: a.fielder.lastName },
    })),
    lineItems: data.lineItems.map((item: typeof data.lineItems[number]) => ({
      id: item.id,
      type: item.type,
      description: item.description,
      amount: toNumber(item.amount),
      fielderId: item.fielderId,
    })),
  };

  return (
    <>
      <Header title={project.projectNumber} subtitle={project.title} />
      <main className="page-main space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={project.status} />
          <span className="text-sm text-muted-foreground">{project.client.name}</span>
          {(project.status === "complete" || project.status === "invoiced") && (
            <>
              <GenerateInvoiceButton projectId={project.id} />
              <GeneratePaymentsButton projectId={project.id} />
            </>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card space-y-3 lg:col-span-2">
            <h2 className="font-semibold text-foreground">Site Details</h2>
            <p className="text-sm">{project.siteAddress}</p>
            <p className="text-sm text-muted-foreground">
              {[project.city, project.state, project.zip].filter(Boolean).join(", ") || "—"}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Job type:</span> {project.jobType || "—"}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">QField login:</span>{" "}
              {project.qfield ? `QField ${project.qfield}` : "—"}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">ECD:</span>{" "}
              {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : "—"}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">SQFT:</span>{" "}
              {toNumber(project.sqft).toLocaleString()}
            </p>
            {project.description && (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            )}
            {project.notes && (
              <p className="text-sm text-muted-foreground">{project.notes}</p>
            )}
          </div>

          <div className="card space-y-3">
            <h2 className="font-semibold text-foreground">Financials</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client SQFT bill</span>
                <span>{formatCurrency(financials.client.sqftAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Additional billing</span>
                <span>{formatCurrency(financials.client.lineItemsTotal)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Client total</span>
                <span className="text-success">{formatCurrency(financials.client.total)}</span>
              </div>
              <hr className="my-2 border-border" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fielder pay</span>
                <span>{formatCurrency(financials.totalFielderPay)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Est. margin</span>
                <span className="text-accent">{formatCurrency(financials.margin)}</span>
              </div>
            </div>
          </div>
        </div>

        <ProjectActions
          project={projectForActions}
          projectState={project.state}
          fielders={fielders.map((f) => ({
            id: f.id,
            name: `${f.firstName} ${f.lastName}`,
            defaultSqftRate: toNumber(f.defaultSqftRate),
          }))}
          financials={financials}
        />

        <ProjectAttachments projectId={project.id} />
      </main>
    </>
  );
}
