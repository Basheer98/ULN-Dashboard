import type { Prisma, ProjectStatus } from "@prisma/client";
import {
  type NormalizedImportRow,
  parseLegacyImportSheet,
  parseProjectImportSheet,
  calculateClientTotal,
} from "@uln/shared";
import { prisma } from "./prisma";
import { resolveRatesForProject, resolveFielderRateForAssignment } from "./rates";

export interface ImportPreviewOptions {
  text: string;
  defaultClientId: string;
  updateExisting?: boolean;
}

export interface ImportPreviewRow extends NormalizedImportRow {
  action: "create" | "update" | "skip";
  existingProjectId: string | null;
  existingStatus: ProjectStatus | null;
  clientSqftRate: number;
  estimatedClientTotal: number;
  fielderSqftRate: number | null;
  estimatedFielderTotal: number | null;
  blockedReason: string | null;
}

export interface ImportPreviewResult {
  format: "tracker" | "legacy" | "unknown";
  rows: ImportPreviewRow[];
  duplicateProjectNumbers: string[];
  stats: {
    total: number;
    importable: number;
    toCreate: number;
    toUpdate: number;
    blocked: number;
    errors: number;
    warnings: number;
    skippedEmpty: number;
    estimatedClientRevenue: number;
  };
  canImport: boolean;
  blockers: string[];
}

const PROTECTED_STATUSES: ProjectStatus[] = ["invoiced", "paid"];

function isProtectedStatus(status: ProjectStatus): boolean {
  return PROTECTED_STATUSES.includes(status);
}

async function loadFielders() {
  return prisma.fielder.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });
}

async function loadExistingProjects(numbers: string[]) {
  if (numbers.length === 0) return new Map<string, { id: string; status: ProjectStatus; sqft: Prisma.Decimal }>();
  const projects = await prisma.project.findMany({
    where: { deletedAt: null, projectNumber: { in: numbers } },
    select: { id: true, projectNumber: true, status: true, sqft: true },
  });
  return new Map(projects.map((p) => [p.projectNumber.toLowerCase(), p]));
}

export async function previewTrackerImport(
  options: ImportPreviewOptions
): Promise<ImportPreviewResult> {
  const blockers: string[] = [];
  const fielders = await loadFielders();
  const parsed = parseProjectImportSheet(options.text, fielders);

  if (parsed.format === "unknown") {
    return {
      format: "unknown",
      rows: [],
      duplicateProjectNumbers: [],
      stats: {
        total: 0,
        importable: 0,
        toCreate: 0,
        toUpdate: 0,
        blocked: 0,
        errors: 0,
        warnings: 0,
        skippedEmpty: 0,
        estimatedClientRevenue: 0,
      },
      canImport: false,
      blockers: [
        "Unrecognized sheet format. Expected columns like Project ID, Qfield, SQFT, Address, Feilder.",
      ],
    };
  }

  const client = await prisma.client.findUnique({ where: { id: options.defaultClientId } });
  if (!client) {
    blockers.push("Selected client not found. Choose a valid billing client.");
  }

  const existingMap = await loadExistingProjects(parsed.rows.map((r) => r.projectNumber));
  const previewRows: ImportPreviewRow[] = [];
  let estimatedClientRevenue = 0;
  let toCreate = 0;
  let toUpdate = 0;
  let blocked = 0;

  for (const row of parsed.rows) {
    const existing = existingMap.get(row.projectNumber.toLowerCase()) ?? null;
    let action: ImportPreviewRow["action"] = "create";
    let blockedReason: string | null = null;

    if (existing) {
      if (options.updateExisting) {
        if (isProtectedStatus(existing.status)) {
          action = "skip";
          blockedReason = `Project is ${existing.status} — will not change billing data`;
          blocked++;
        } else {
          action = "update";
          toUpdate++;
        }
      } else {
        action = "skip";
        blockedReason = "Project already exists (enable Update existing to sync)";
        blocked++;
      }
    } else if (row.importable) {
      toCreate++;
    }

    const rates = await resolveRatesForProject(options.defaultClientId, row.state);
    const clientSqftRate = rates.client.clientSqftRate;
    const estimatedClientTotal = calculateClientTotal(row.sqft, clientSqftRate, []).total;

    let fielderSqftRate: number | null = null;
    let estimatedFielderTotal: number | null = null;
    if (row.fielderId) {
      const fr = await resolveFielderRateForAssignment(row.fielderId, row.state);
      fielderSqftRate = fr.fielderSqftRate;
      estimatedFielderTotal = row.sqft * fielderSqftRate;
    }

    if (row.importable && action === "create") {
      estimatedClientRevenue += estimatedClientTotal;
    }

    previewRows.push({
      ...row,
      action,
      existingProjectId: existing?.id ?? null,
      existingStatus: existing?.status ?? null,
      clientSqftRate,
      estimatedClientTotal,
      fielderSqftRate,
      estimatedFielderTotal,
      blockedReason,
    });
  }

  if (parsed.duplicateProjectNumbers.length > 0) {
    blockers.push(
      `Duplicate project numbers in file: ${parsed.duplicateProjectNumbers.join(", ")}`
    );
  }

  const importable = previewRows.filter((r) => r.importable && r.action !== "skip").length;
  const canImport = blockers.length === 0 && importable > 0 && !!client;

  return {
    format: parsed.format,
    rows: previewRows,
    duplicateProjectNumbers: parsed.duplicateProjectNumbers,
    stats: {
      total: parsed.stats.total,
      importable,
      toCreate,
      toUpdate,
      blocked,
      errors: parsed.stats.errors,
      warnings: parsed.stats.warnings,
      skippedEmpty: parsed.stats.skippedEmpty,
      estimatedClientRevenue,
    },
    canImport,
    blockers,
  };
}

export interface ExecuteImportOptions extends ImportPreviewOptions {
  acknowledgeWarnings?: boolean;
}

export interface ImportRowResult {
  row: number;
  projectNumber: string;
  status: "created" | "updated" | "skipped" | "error";
  message?: string;
}

export interface ExecuteImportResult {
  created: number;
  updated: number;
  skipped: number;
  errored: number;
  results: ImportRowResult[];
}

function projectDataFromRow(
  row: NormalizedImportRow,
  clientId: string,
  clientSqftRate: number,
  createdById: string
): Prisma.ProjectUncheckedCreateInput {
  return {
    projectNumber: row.projectNumber,
    clientId,
    title: row.projectNumber,
    siteAddress: row.siteAddress,
    city: row.city,
    state: row.state,
    zip: row.zip,
    qfield: row.qfield,
    sqft: row.sqft,
    buriedSqft: row.buriedSqft,
    aerialSqft: row.aerialSqft,
    clientSqftRate,
    status: row.projectStatus,
    dueDate: row.dueDate ? new Date(row.dueDate) : null,
    notes: row.notes,
    ...(row.projectStatus === "complete" || row.projectStatus === "invoiced"
      ? { completedAt: new Date() }
      : {}),
    createdById,
  };
}

export async function executeTrackerImport(
  options: ExecuteImportOptions,
  userId: string
): Promise<ExecuteImportResult> {
  const preview = await previewTrackerImport(options);

  if (!preview.canImport) {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      errored: 1,
      results: [
        {
          row: 0,
          projectNumber: "",
          status: "error",
          message: preview.blockers.join(" ") || "Import blocked — fix errors in preview first",
        },
      ],
    };
  }

  const hasWarnings = preview.stats.warnings > 0;
  if (hasWarnings && !options.acknowledgeWarnings) {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      errored: 1,
      results: [
        {
          row: 0,
          projectNumber: "",
          status: "error",
          message: "Import has warnings — review preview and confirm to proceed",
        },
      ],
    };
  }

  const results: ImportRowResult[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errored = 0;

  for (const row of preview.rows) {
    if (!row.importable || row.action === "skip") {
      skipped++;
      results.push({
        row: row.rowNumber,
        projectNumber: row.projectNumber,
        status: "skipped",
        message: row.blockedReason ?? "Not importable",
      });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const rates = await resolveRatesForProject(options.defaultClientId, row.state);

        if (row.action === "create") {
          const project = await tx.project.create({
            data: projectDataFromRow(row, options.defaultClientId, rates.client.clientSqftRate, userId),
          });

          if (row.fielderId && row.assignmentStatus) {
            const fielderRate = await resolveFielderRateForAssignment(row.fielderId, row.state);
            await tx.assignment.create({
              data: {
                projectId: project.id,
                fielderId: row.fielderId,
                assignedSqft: row.sqft,
                fielderSqftRate: fielderRate.fielderSqftRate,
                status: row.assignmentStatus,
                ...(row.assignmentStatus === "complete" ? { completedAt: new Date() } : {}),
              },
            });
          }
        } else if (row.action === "update" && row.existingProjectId) {
          await tx.project.update({
            where: { id: row.existingProjectId },
            data: {
              siteAddress: row.siteAddress,
              city: row.city,
              state: row.state,
              zip: row.zip,
              qfield: row.qfield,
              sqft: row.sqft,
              buriedSqft: row.buriedSqft,
              aerialSqft: row.aerialSqft,
              clientSqftRate: rates.client.clientSqftRate,
              dueDate: row.dueDate ? new Date(row.dueDate) : null,
              notes: row.notes,
              status: row.projectStatus,
              ...(row.projectStatus === "complete" || row.projectStatus === "invoiced"
                ? { completedAt: new Date() }
                : {}),
            },
          });

          if (row.fielderId && row.assignmentStatus) {
            const fielderRate = await resolveFielderRateForAssignment(row.fielderId, row.state);
            const existingAssignment = await tx.assignment.findUnique({
              where: {
                projectId_fielderId: {
                  projectId: row.existingProjectId,
                  fielderId: row.fielderId,
                },
              },
            });
            if (existingAssignment) {
              await tx.assignment.update({
                where: { id: existingAssignment.id },
                data: {
                  assignedSqft: row.sqft,
                  fielderSqftRate: fielderRate.fielderSqftRate,
                  status: row.assignmentStatus,
                  ...(row.assignmentStatus === "complete" ? { completedAt: new Date() } : {}),
                },
              });
            } else {
              await tx.assignment.create({
                data: {
                  projectId: row.existingProjectId,
                  fielderId: row.fielderId,
                  assignedSqft: row.sqft,
                  fielderSqftRate: fielderRate.fielderSqftRate,
                  status: row.assignmentStatus,
                  ...(row.assignmentStatus === "complete" ? { completedAt: new Date() } : {}),
                },
              });
            }
          }
        }
      });

      if (row.action === "create") {
        created++;
        results.push({ row: row.rowNumber, projectNumber: row.projectNumber, status: "created" });
      } else {
        updated++;
        results.push({ row: row.rowNumber, projectNumber: row.projectNumber, status: "updated" });
      }
    } catch (err) {
      errored++;
      results.push({
        row: row.rowNumber,
        projectNumber: row.projectNumber,
        status: "error",
        message: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  return { created, updated, skipped, errored, results };
}

/** Legacy import path — client name per row */
export async function executeLegacyImport(
  text: string,
  userId: string,
  updateExisting = false
): Promise<ExecuteImportResult> {
  const { rows, format } = parseLegacyImportSheet(text);
  if (format !== "legacy") {
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      errored: 1,
      results: [{ row: 0, projectNumber: "", status: "error", message: "Unrecognized legacy format" }],
    };
  }

  const clients = await prisma.client.findMany();
  const clientByName = new Map(clients.map((c) => [c.name.toLowerCase(), c]));
  const results: ImportRowResult[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errored = 0;

  for (const row of rows) {
    if (!row.importable) {
      errored++;
      results.push({
        row: row.rowNumber,
        projectNumber: row.projectNumber,
        status: "error",
        message: row.issues.map((i) => i.message).join("; "),
      });
      continue;
    }

    try {
      let client = clientByName.get(row.client.toLowerCase());
      if (!client) {
        client = await prisma.client.create({
          data: { name: row.client.trim(), defaultSqftRate: 0.03 },
        });
        clientByName.set(client.name.toLowerCase(), client);
      }

      const existing = await prisma.project.findUnique({
        where: { projectNumber: row.projectNumber },
      });

      if (existing && !existing.deletedAt && !updateExisting) {
        skipped++;
        results.push({
          row: row.rowNumber,
          projectNumber: row.projectNumber,
          status: "skipped",
          message: "Already exists",
        });
        continue;
      }

      if (existing && !existing.deletedAt && isProtectedStatus(existing.status)) {
        skipped++;
        results.push({
          row: row.rowNumber,
          projectNumber: row.projectNumber,
          status: "skipped",
          message: `Protected status: ${existing.status}`,
        });
        continue;
      }

      const rates = await resolveRatesForProject(client.id, row.state);

      if (existing) {
        await prisma.project.update({
          where: { id: existing.id },
          data: {
            title: row.title,
            siteAddress: row.address || "—",
            state: row.state,
            sqft: row.sqft,
            qfield: row.qfield,
            deletedAt: null,
            clientSqftRate: rates.client.clientSqftRate,
            dueDate: row.ecd ? new Date(row.ecd) : null,
          },
        });
        updated++;
        results.push({ row: row.rowNumber, projectNumber: row.projectNumber, status: "updated" });
      } else {
        await prisma.project.create({
          data: {
            projectNumber: row.projectNumber,
            clientId: client.id,
            title: row.title,
            siteAddress: row.address || "—",
            state: row.state,
            sqft: row.sqft,
            qfield: row.qfield,
            clientSqftRate: rates.client.clientSqftRate,
            dueDate: row.ecd ? new Date(row.ecd) : null,
            status: "draft",
            createdById: userId,
          },
        });
        created++;
        results.push({ row: row.rowNumber, projectNumber: row.projectNumber, status: "created" });
      }
    } catch (err) {
      errored++;
      results.push({
        row: row.rowNumber,
        projectNumber: row.projectNumber,
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  return { created, updated, skipped, errored, results };
}
