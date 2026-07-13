import { FinanceHeader } from "@/components/finance/finance-nav";
import { TripsManager } from "@/components/trips-manager";

export default function TripsPage() {
  return (
    <>
      <FinanceHeader title="Trips" subtitle="Multi-day travel and project groupings" />
      <main className="page-main">
        <TripsManager />
      </main>
    </>
  );
}
