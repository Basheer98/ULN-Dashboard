import { NextRequest } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser } from "@/lib/api";
import { fetchProjectTrackerSheet, getProjectSheetStatus } from "@/lib/google-sheets";
import { executeTrackerImport } from "@/lib/project-import-service";
import { maskSpreadsheetId } from "@uln/shared";

export async function GET(request: NextRequest) {
  try {
    requireOfficeUser(await getRequestUser(request));
    const status = await getProjectSheetStatus();
    return jsonOk({
      ...status,
      spreadsheetId: status.spreadsheetId
        ? maskSpreadsheetId(status.spreadsheetId)
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const postSchema = z.object({
  action: z.enum(["fetch", "import", "push"]),
  defaultClientId: z.string().optional(),
  updateExisting: z.boolean().optional(),
  acknowledgeWarnings: z.boolean().optional(),
  spreadsheetId: z.string().optional(),
  projectNumbers: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = requireOfficeUser(await getRequestUser(request));
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

    const sheet = await fetchProjectTrackerSheet({
      spreadsheetId: parsed.data.spreadsheetId,
    });

    if (parsed.data.action === "fetch") {
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

    // Best-effort write-back of imported project statuses
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
