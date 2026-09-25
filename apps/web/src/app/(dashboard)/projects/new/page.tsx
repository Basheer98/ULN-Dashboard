import { Suspense } from "react";
import { canViewProjectFinancials } from "@uln/shared";
import { getSessionUser } from "@/lib/auth";
import NewProjectPage from "./new-project-form";

export default async function Page() {
  const user = await getSessionUser();
  const canSeeMoney = user ? canViewProjectFinancials(user.role) : false;

  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading...</div>}>
      <NewProjectPage canSeeMoney={canSeeMoney} />
    </Suspense>
  );
}
