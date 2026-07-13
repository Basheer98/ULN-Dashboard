import { FinanceHeader } from "@/components/finance/finance-nav";
import { ReconciliationForm } from "@/components/finance/finance-forms";
import { prisma } from "@/lib/prisma";

export default async function NewReconciliationPage() {
  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <FinanceHeader title="New Reconciliation" subtitle="Start a bank reconciliation session" />
      <main className="page-main">
        <ReconciliationForm
          paymentMethods={paymentMethods.map((pm) => ({ id: pm.id, name: pm.name }))}
        />
      </main>
    </>
  );
}
