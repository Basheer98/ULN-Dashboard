import { NextRequest } from "next/server";
import { z } from "zod";
import { FINANCE_SETTING_KEYS } from "@uln/shared";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireFinanceAdmin, requireFinanceRead } from "@/lib/finance-auth";
import { getFinanceSettings, setFinanceSetting } from "@/lib/finance-settings";
import { logFinanceAudit } from "@/lib/finance-audit";

const settingsUpdateSchema = z.record(z.string());

export async function GET(request: NextRequest) {
  try {
    requireFinanceRead(await getRequestUser(request));
    const settings = await getFinanceSettings();
    return jsonOk(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = requireFinanceAdmin(await getRequestUser(request));
    const body = await request.json();
    const parsed = settingsUpdateSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid settings payload", 400);

    const oldSettings = await getFinanceSettings();
    const validKeys = new Set(Object.values(FINANCE_SETTING_KEYS));

    for (const [key, value] of Object.entries(parsed.data)) {
      if (!validKeys.has(key as (typeof FINANCE_SETTING_KEYS)[keyof typeof FINANCE_SETTING_KEYS])) {
        return jsonError(`Unknown setting key: ${key}`, 400);
      }
      await setFinanceSetting(key, value);
    }

    const newSettings = await getFinanceSettings();
    await logFinanceAudit("updated", "financial_setting", "all", { user, request }, oldSettings, newSettings);

    return jsonOk(newSettings);
  } catch (error) {
    return handleApiError(error);
  }
}
