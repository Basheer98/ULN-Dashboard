import { NextRequest } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser } from "@/lib/api";
import {
  executeLegacyImport,
  executeTrackerImport,
} from "@/lib/project-import-service";
import { parseLegacyImportSheet } from "@uln/shared";

const importSchema = z.object({
  text: z.string().min(1),
  defaultClientId: z.string().optional(),
  updateExisting: z.boolean().optional(),
  acknowledgeWarnings: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = requireOfficeUser(await getRequestUser(request));
    const body = await request.json();
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Invalid import data", 400);
    }

    const legacy = parseLegacyImportSheet(parsed.data.text);
    if (legacy.format === "legacy") {
      const result = await executeLegacyImport(
        parsed.data.text,
        user.id,
        parsed.data.updateExisting ?? false
      );
      return jsonOk(result, 201);
    }

    if (!parsed.data.defaultClientId) {
      return jsonError("Billing client is required for project tracker imports", 400);
    }

    const result = await executeTrackerImport(
      {
        text: parsed.data.text,
        defaultClientId: parsed.data.defaultClientId,
        updateExisting: parsed.data.updateExisting ?? false,
        acknowledgeWarnings: parsed.data.acknowledgeWarnings ?? false,
      },
      user.id
    );

    if (result.errored > 0 && result.created === 0 && result.updated === 0) {
      return jsonError(result.results[0]?.message ?? "Import failed", 400);
    }

    return jsonOk(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
