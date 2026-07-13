import { prisma } from "./prisma";
import { DEFAULT_FINANCE_SETTINGS, FINANCE_SETTING_KEYS } from "@uln/shared";

export async function getFinanceSetting(key: string): Promise<string> {
  const row = await prisma.financialSetting.findUnique({ where: { key } });
  return row?.value ?? DEFAULT_FINANCE_SETTINGS[key] ?? "";
}

export async function getFinanceSettings(): Promise<Record<string, string>> {
  const rows = await prisma.financialSetting.findMany();
  const map: Record<string, string> = { ...DEFAULT_FINANCE_SETTINGS };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

export async function getMileageRate(): Promise<number> {
  const value = await getFinanceSetting(FINANCE_SETTING_KEYS.mileageRate);
  return parseFloat(value) || 0.67;
}

export async function setFinanceSetting(key: string, value: string) {
  return prisma.financialSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function seedFinanceSettings() {
  for (const [key, value] of Object.entries(DEFAULT_FINANCE_SETTINGS)) {
    await prisma.financialSetting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }
}
