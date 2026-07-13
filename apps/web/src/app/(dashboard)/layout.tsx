import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user || user.role === "fielder") {
    redirect("/login");
  }

  return <DashboardShell role={user.role}>{children}</DashboardShell>;
}
