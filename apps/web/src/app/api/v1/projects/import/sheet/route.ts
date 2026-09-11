import { NextRequest } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser, requirePermission } from "@/lib/api";
import {
  fetchAllProjectTrackerTabs,
  fetchProjectTrackerSheet,
  getProjectSheetStatus,
  listProjectSheetTabs,
} from "@/lib/google-sheets";
import { executeTrackerImport } from "@/lib/project-import-service";
import { maskSpreadsheetId, parseProjectImportSheet } from "@uln/shared";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    requireOfficeUser(await getRequestUser(request));
    const status = await getProjectSheetStatus();
    let tabs: string[] = [];
    if (status.ready) {
      try {
        const listed = await listProjectSheetTabs();
        tabs = listed.tabs;
      } catch {
        tabs = [];
      }
    }
    return jsonOk({
      ...status,
      spreadsheetId: status.spreadsheetId
        ? maskSpreadsheetId(status.spreadsheetId)
        : null,
      tabs,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const postSchema = z.object({
  action: z.enum(["fetch", "fetchAll", "import", "importAll", "push"]),
  defaultClientId: z.string().optional(),
  updateExisting: z.boolean().optional(),
  acknowledgeWarnings: z.boolean().optional(),
  spreadsheetId: z.string().optional(),
  tabName: z.string().optional(),
  projectNumbers: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = requirePermission(await getRequestUser(request), "projects:write");
    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
    }

    if (parsed.data.action === "push") {
      const { syncProjectsToGoogleSheet } = await import("@/lib/sheet-writeback");
      const result = await syncProjectsToGoogleSheet(parsed.data.projectNumbers);
      return jsonOk(result);
    }

    if (!parsed.data.defaultClientId) {
      return jsonError("Billing client is required for project tracker imports", 400);
    }

    if (parsed.data.action === "fetch") {
      const sheet = await fetchProjectTrackerSheet({
        spreadsheetId: parsed.data.spreadsheetId,
        tabName: parsed.data.tabName,
      });
      return jsonOk({
        text: sheet.csv,
        meta: {
          tabName: sheet.tabName,
          range: sheet.range,
          rowCount: sheet.rowCount,
          fetchedAt: sheet.fetchedAt,
        },
      });
    }

    if (parsed.data.action === "fetchAll") {
      const all = await fetchAllProjectTrackerTabs({
        spreadsheetId: parsed.data.spreadsheetId,
      });
      const fielders = await prisma.fielder.findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true },
      });

      const usable = all.tabs.filter((tab) => {
        const parsedSheet = parseProjectImportSheet(tab.csv, fielders);
        return parsedSheet.format === "tracker";
      });

      return jsonOk({
        tabs: usable.map((t) => ({
          tabName: t.tabName,
          text: t.csv,
          rowCount: t.rowCount,
          fetchedAt: t.fetchedAt,
        })),
        skipped: [
          ...all.skipped,
          ...all.tabs
            .filter((t) => !usable.some((u) => u.tabName === t.tabName))
            .map((t) => t.tabName),
        ],
        meta: {
          tabCount: usable.length,
          fetchedAt: new Date().toISOString(),
        },
      });
    }

    if (parsed.data.action === "importAll") {
      const all = await fetchAllProjectTrackerTabs({
        spreadsheetId: parsed.data.spreadsheetId,
      });
      const fielders = await prisma.fielder.findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true },
      });

      const tabResults: Array<{
        tabName: string;
        created: number;
        updated: number;
        skipped: number;
        errored: number;
        message?: string;
      }> = [];

      let created = 0;
      let updated = 0;
      let skipped = 0;
      let errored = 0;
      const projectNumbers: string[] = [];

      for (const tab of all.tabs) {
        const parsedSheet = parseProjectImportSheet(tab.csv, fielders);
        if (parsedSheet.format !== "tracker") {
          tabResults.push({
            tabName: tab.tabName,
            created: 0,
            updated: 0,
            skipped: 0,
            errored: 0,
            message: "Skipped — not a tracker sheet",
          });
          continue;
        }

        const result = await executeTrackerImport(
          {
            text: tab.csv,
            defaultClientId: parsed.data.defaultClientId,
            updateExisting: parsed.data.updateExisting ?? false,
            acknowledgeWarnings: parsed.data.acknowledgeWarnings ?? false,
          },
          user.id
        );

        created += result.created;
        updated += result.updated;
        skipped += result.skipped;
        errored += result.errored;
        projectNumbers.push(
          ...result.results
            .filter((r) => r.status === "created" || r.status === "updated")
            .map((r) => r.projectNumber)
        );

        tabResults.push({
          tabName: tab.tabName,
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          errored: result.errored,
          message: result.results.find((r) => r.status === "error")?.message,
        });
      }

      let writeBack: unknown = null;
      try {
        const { syncProjectsToGoogleSheet } = await import("@/lib/sheet-writeback");
        const unique = [...new Set(projectNumbers.filter(Boolean))];
        if (unique.length) writeBack = await syncProjectsToGoogleSheet(unique);
      } catch {
        writeBack = { skipped: true, reason: "Write-back failed" };
      }

      return jsonOk(
        {
          created,
          updated,
          skipped,
          errored,
          tabResults,
          skippedTabs: all.skipped,
          writeBack,
        },
        201
      );
    }

    // Single-tab import (legacy path)
    const sheet = await fetchProjectTrackerSheet({
      spreadsheetId: parsed.data.spreadsheetId,
      tabName: parsed.data.tabName,
    });

    const result = await executeTrackerImport(
      {
        text: sheet.csv,
        defaultClientId: parsed.data.defaultClientId,
        updateExisting: parsed.data.updateExisting ?? false,
        acknowledgeWarnings: parsed.data.acknowledgeWarnings ?? false,
      },
      user.id
    );

    if (result.errored > 0 && result.created === 0 && result.updated === 0) {
      return jsonError(result.results[0]?.message ?? "Sheet import failed", 400);
    }

    let writeBack: unknown = null;
    try {
      const { syncProjectsToGoogleSheet } = await import("@/lib/sheet-writeback");
      const numbers = result.results
        .filter((r) => r.status === "created" || r.status === "updated")
        .map((r) => r.projectNumber)
        .filter(Boolean);
      if (numbers.length) {
        writeBack = await syncProjectsToGoogleSheet(numbers);
      }
    } catch {
      writeBack = { skipped: true, reason: "Write-back failed (check Sheets Editor access)" };
    }

    return jsonOk(
      {
        ...result,
        writeBack,
        meta: {
          tabName: sheet.tabName,
          range: sheet.range,
          rowCount: sheet.rowCount,
          fetchedAt: sheet.fetchedAt,
        },
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
