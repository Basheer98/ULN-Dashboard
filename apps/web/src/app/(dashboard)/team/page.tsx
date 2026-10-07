import Link from "next/link";
import { Header } from "@/components/layout";
import { TeamUserForm } from "@/components/team-form";
import { TeamMemberActions } from "@/components/team-member-actions";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@uln/shared";

type TeamRow = {
  id: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
};

function displayName(u: TeamRow) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
}

export default async function TeamPage() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.role, "users:read")) {
    redirect("/dashboard");
  }
  const canManage = hasPermission(user.role, "users:write");
  const currentUserId = user.id;

  const users = await prisma.user.findMany({
    where: { role: { not: "fielder" } },
    select: {
      id: true, email: true, role: true, firstName: true, lastName: true,
      isActive: true, lastLoginAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const active = users.filter((u) => u.isActive);
  const removed = users.filter((u) => !u.isActive);

  function renderTable(rows: TeamRow[]) {
    return (
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Login</th>
            {canManage && <th className="text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td>
                {canManage ? (
                  <Link href={`/team/${u.id}`} className="font-medium text-foreground hover:text-accent">
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                  </Link>
                ) : (
                  [u.firstName, u.lastName].filter(Boolean).join(" ") || "—"
                )}
              </td>
              <td>{u.email}</td>
              <td className="capitalize">{u.role === "coordinator" ? "Project coordinator" : u.role}</td>
              <td>
                <span className={`badge ${u.isActive ? "badge-success" : "badge-danger"}`}>
                  {u.isActive ? "Active" : "Removed"}
                </span>
              </td>
              <td>{u.lastLoginAt ? u.lastLoginAt.toLocaleDateString() : "—"}</td>
              {canManage && (
                <td className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Link href={`/team/${u.id}`} className="btn-secondary text-xs">
                      View profile
                    </Link>
                    <TeamMemberActions
                      userId={u.id}
                      name={displayName(u)}
                      isActive={u.isActive}
                      isSelf={u.id === currentUserId}
                    />
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <>
      <Header title="Team" subtitle="Office accounts — admin, dispatcher, accountant, project coordinator" />
      <main className="page-main space-y-6">
        {canManage && <TeamUserForm />}

        <div className="card overflow-x-auto">{renderTable(active)}</div>

        {removed.length > 0 && (
          <div className="card space-y-3 overflow-x-auto">
            <div>
              <h2 className="font-semibold text-foreground">Removed members</h2>
              <p className="text-sm text-muted-foreground">
                These accounts can&apos;t sign in. They&apos;re kept because their name appears on past
                projects or records.
              </p>
            </div>
            {renderTable(removed)}
          </div>
        )}
      </main>
    </>
  );
}
