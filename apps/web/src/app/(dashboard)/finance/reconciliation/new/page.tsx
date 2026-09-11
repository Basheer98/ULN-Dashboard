import { FinanceHeader } from "@/components/finance/finance-nav";
import { ReconciliationForm } from "@/components/finance/finance-forms";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@uln/shared";

export default async function NewReconciliationPage() {
  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const prior = await prisma.bankReconciliation.findMany({
    orderBy: [{ statementDate: "desc" }, { createdAt: "desc" }],
    select: { paymentMethodId: true, endingBalance: true },
  });

  const lastEndingByMethod: Record<string, number> = {};
  for (const row of prior) {
    if (lastEndingByMethod[row.paymentMethodId] == null) {
      lastEndingByMethod[row.paymentMethodId] = toNumber(row.endingBalance);
    }
  }

  return (
    <>
      <FinanceHeader title="New Reconciliation" subtitle="Start a bank reconciliation session" />
      <main className="page-main">
        <ReconciliationForm
          paymentMethods={paymentMethods.map((pm) => ({ id: pm.id, name: pm.name }))}
          lastEndingByMethod={lastEndingByMethod}
        />
      </main>
    </>
  );
}
