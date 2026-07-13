import { FinanceHeader } from "@/components/finance/finance-nav";
import { VehiclesManager } from "@/components/vehicles-manager";

export default function VehiclesPage() {
  return (
    <>
      <FinanceHeader title="Vehicles" subtitle="Company vehicles for mileage tracking" />
      <main className="page-main">
        <VehiclesManager />
      </main>
    </>
  );
}
