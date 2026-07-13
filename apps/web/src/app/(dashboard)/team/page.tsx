import { Header, StatusBadge } from "@/components/layout";
import { TeamUserForm } from "@/components/team-form";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@uln/shared";

export default async function TeamPage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "users:read")) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    where: { role: { not: "fielder" } },
    select: {
      id: true, email: true, role: true, firstName: true, lastName: true,
      isActive: true, lastLoginAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Header title="Team" subtitle="Office accounts — admin, dispatcher, accountant" />
      <main className="page-main space-y-6">
        {hasPermission(user.role, "users:write") && <TeamUserForm />}

        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}</td>
                  <td>{u.email}</td>
                  <td className="capitalize">{u.role}</td>
                  <td>
                    <StatusBadge status={u.isActive ? "complete" : "cancelled"} />
                    {!u.isActive && <span className="ml-1 text-xs text-muted-foreground">Inactive</span>}
                  </td>
                  <td>{u.lastLoginAt ? u.lastLoginAt.toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
