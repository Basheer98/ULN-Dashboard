import { prisma } from "@/lib/prisma";
import { toNumber } from "@uln/shared";
import {
  writeBackProjectsToSheet,
  type ProjectSheetWriteRow,
  type SheetWriteBackResult,
} from "@/lib/google-sheets";

/**
 * Load projects (and primary fielder) and push status columns to Google Sheet.
 * Safe no-op when Sheets is not configured or write-back disabled.
 */
export async function syncProjectsToGoogleSheet(
  projectNumbers?: string[]
): Promise<SheetWriteBackResult | { skipped: true; reason: string }> {
  if (process.env.GOOGLE_SHEETS_WRITE_BACK === "false") {
    return { skipped: true, reason: "GOOGLE_SHEETS_WRITE_BACK=false" };
  }
  if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    return { skipped: true, reason: "Sheets not configured" };
  }

  const projects = await prisma.project.findMany({
    where: projectNumbers?.length
      ? { projectNumber: { in: projectNumbers } }
      : undefined,
    select: {
      projectNumber: true,
      sqft: true,
      status: true,
      notes: true,
      assignments: {
        where: { status: { not: "cancelled" } },
        orderBy: { assignedAt: "asc" },
        take: 1,
        include: { fielder: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  const rows: ProjectSheetWriteRow[] = projects.map((p) => {
    const fielder = p.assignments[0]?.fielder;
    const fielderName = fielder
      ? `${fielder.firstName}${fielder.lastName ? ` ${fielder.lastName}` : ""}`.trim()
      : null;
    return {
      projectNumber: p.projectNumber,
      sqft: toNumber(p.sqft),
      status: p.status,
      fielderName,
      notes: p.notes,
    };
  });

  return writeBackProjectsToSheet(rows);
}

export async function syncSingleProjectToGoogleSheet(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { projectNumber: true },
  });
  if (!project) return { skipped: true as const, reason: "Project not found" };
  return syncProjectsToGoogleSheet([project.projectNumber]);
}
