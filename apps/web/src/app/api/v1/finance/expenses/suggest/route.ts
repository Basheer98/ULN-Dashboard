import { NextRequest } from "next/server";
import { z } from "zod";
import { hasPermission } from "@uln/shared";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFielderSelf } from "@/lib/finance-auth";
import {
  getExpensePolicyThresholds,
  suggestExpenseFields,
} from "@/lib/expense-smart-service";

const suggestSchema = z.object({
  description: z.string().optional().nullable(),
  vendorName: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  amount: z.coerce.number().positive().optional(),
  transactionDate: z.string().optional(),
  fielderId: z.string().optional().nullable(),
  excludeExpenseId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) return jsonError("Unauthorized", 401);

    const canSuggest =
      hasPermission(user.role, "finance:read") ||
      hasPermission(user.role, "finance:write") ||
      hasPermission(user.role, "finance:admin") ||
      hasPermission(user.role, "expense:self:create");
    if (!canSuggest) return jsonError("Forbidden", 403);

    const body = await request.json();
    const parsed = suggestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const fielderId =
      user.role === "fielder" && user.fielderId
        ? user.fielderId
        : parsed.data.fielderId ?? null;

    if (user.role === "fielder") {
      requireFielderSelf(user);
    }

    const [suggestions, thresholds] = await Promise.all([
      suggestExpenseFields({
        ...parsed.data,
        fielderId,
      }),
      getExpensePolicyThresholds(),
    ]);

    return jsonOk({
      ...suggestions,
      policy: thresholds,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
