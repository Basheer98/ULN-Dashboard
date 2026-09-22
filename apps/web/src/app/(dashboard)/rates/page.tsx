import { Header } from "@/components/layout";
import { ProjectTitlesManager } from "@/components/project-titles-manager";
import { StateRatesManager } from "@/components/state-rates-manager";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@uln/shared";
import { redirect } from "next/navigation";

export default async function RatesPage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "rates:read")) {
    redirect("/dashboard");
  }

  const canEditRates = hasPermission(user.role, "rates:write");
  const canEditTitles = hasPermission(user.role, "projects:write");

  return (
    <>
      <Header
        title="Rates"
        subtitle="Company defaults, state overrides, and project title catalog"
      />
      <main className="page-main space-y-8">
        <StateRatesManager canEdit={canEditRates} />
        <ProjectTitlesManager canEdit={canEditTitles} />
      </main>
    </>
  );
}
