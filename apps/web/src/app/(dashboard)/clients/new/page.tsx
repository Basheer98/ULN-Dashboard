import { canViewProjectFinancials } from "@uln/shared";
import { getSessionUser } from "@/lib/auth";
import NewClientForm from "./new-client-form";

export default async function Page() {
  const user = await getSessionUser();
  return <NewClientForm canSeeMoney={user ? canViewProjectFinancials(user.role) : false} />;
}
