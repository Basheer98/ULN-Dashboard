import { NextRequest } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser } from "@/lib/api";
import { previewTrackerImport } from "@/lib/project-import-service";
import { parseLegacyImportSheet } from "@uln/shared";

const previewSchema = z.object({
  text: z.string().min(1),
  defaultClientId: z.string().min(1, "Billing client is required"),
  updateExisting: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    requireOfficeUser(await getRequestUser(request));
    const body = await request.json();
    const parsed = previewSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Invalid preview request", 400);
    }

    const legacy = parseLegacyImportSheet(parsed.data.text);
    if (legacy.format === "legacy") {
      return jsonOk({
        format: "legacy",
        legacyRows: legacy.rows,
        canImport: legacy.rows.some((r) => r.importable),
        blockers: [],
        stats: {
          total: legacy.rows.length,
          importable: legacy.rows.filter((r) => r.importable).length,
        },
      });
    }

    const preview = await previewTrackerImport(parsed.data);
    return jsonOk(preview);
  } catch (error) {
    return handleApiError(error);
  }
}
