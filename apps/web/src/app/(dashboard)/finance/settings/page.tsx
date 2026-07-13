import { FinanceHeader } from "@/components/finance/finance-nav";
import { SettingsTabs } from "@/components/finance/finance-forms";
import { getFinanceSettings } from "@/lib/finance-settings";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@uln/shared";

export default async function FinanceSettingsPage() {
  const [settings, categories, paymentMethods, vendors] = await Promise.all([
    getFinanceSettings(),
    prisma.expenseCategory.findMany({
      include: { subcategories: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.paymentMethod.findMany({ orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <FinanceHeader title="Finance Settings" subtitle="Categories, payment methods, vendors, and defaults" />
      <main className="page-main">
        <SettingsTabs
          initialSettings={settings}
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            isActive: c.isActive,
            subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name })),
          }))}
          paymentMethods={paymentMethods.map((pm) => ({
            id: pm.id,
            name: pm.name,
            type: pm.type,
            currentBalance: toNumber(pm.currentBalance),
            isActive: pm.isActive,
          }))}
          vendors={vendors.map((v) => ({
            id: v.id,
            name: v.name,
            vendorType: v.vendorType,
            isActive: v.isActive,
          }))}
        />
      </main>
    </>
  );
}
