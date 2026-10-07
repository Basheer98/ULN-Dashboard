import { Suspense } from "react";
import { canViewProjectFinancials, hasPermission } from "@uln/shared";
import { getSessionUser } from "@/lib/auth";
import NewProjectPage from "./new-project-form";

export default async function Page() {
  const user = await getSessionUser();
  const canSeeMoney = user ? canViewProjectFinancials(user.role) : false;
  const canAssign = user ? hasPermission(user.role, "projects:write") : false;
  const canAddClient = user ? hasPermission(user.role, "clients:write") : false;

  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading...</div>}>
      <NewProjectPage canSeeMoney={canSeeMoney} canAssign={canAssign} canAddClient={canAddClient} />
    </Suspense>
  );
}
