import { canViewProjectFinancials } from "@uln/shared";
import { getSessionUser } from "@/lib/auth";
import NewFielderForm from "./new-fielder-form";

export default async function Page() {
  const user = await getSessionUser();
  return <NewFielderForm canSeeMoney={user ? canViewProjectFinancials(user.role) : false} />;
}
