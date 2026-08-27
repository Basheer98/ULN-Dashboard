import { NextRequest } from "next/server";
import { z } from "zod";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceWrite } from "@/lib/finance-auth";
import {
  applyBankStatementImport,
  previewBankStatementImport,
} from "@/lib/bank-statement-import";
import { logFinanceAudit } from "@/lib/finance-audit";

const bodySchema = z.object({
  action: z.enum(["preview", "apply"]),
  statementText: z.string().min(1, "Statement file content is required"),
  clearConfidences: z.array(z.enum(["exact", "strong", "weak"])).optional(),
  includeUnmatchedAsManual: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireFinanceWrite(await getRequestUser(request));
    const { id } = await params;
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message ?? "Invalid input", 400);
    }

    if (parsed.data.action === "preview") {
      const preview = await previewBankStatementImport({
        reconciliationId: id,
        statementText: parsed.data.statementText,
      });
      return jsonOk(preview);
    }

    const result = await applyBankStatementImport({
      reconciliationId: id,
      statementText: parsed.data.statementText,
      clearConfidences: parsed.data.clearConfidences,
      includeUnmatchedAsManual: parsed.data.includeUnmatchedAsManual,
    });

    await logFinanceAudit(
      "updated",
      "reconciliation",
      id,
      { user, request },
      undefined,
      { action: "bank_statement_import", ...result }
    );

    return jsonOk(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
