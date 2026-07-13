import { Header } from "@/components/layout";
import { StateRatesManager } from "@/components/state-rates-manager";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@uln/shared";
import { redirect } from "next/navigation";

export default async function RatesPage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "rates:read")) {
    redirect("/dashboard");
  }

  return (
    <>
      <Header
        title="Rates"
        subtitle="Company defaults and per-state SQFT rate overrides"
      />
      <main className="page-main">
        <StateRatesManager canEdit={hasPermission(user.role, "rates:write")} />
      </main>
    </>
  );
}
