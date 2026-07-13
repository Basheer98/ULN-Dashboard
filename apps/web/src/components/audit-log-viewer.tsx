"use client";

import { useCallback, useEffect, useState } from "react";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  user: { email: string; firstName: string | null; lastName: string | null } | null;
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: "100" });
    if (entityType) params.set("entityType", entityType);
    const res = await fetch(`/api/v1/finance/audit-logs?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs ?? []);
    }
    setLoading(false);
  }, [entityType]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Entity Type</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="w-full sm:min-w-[160px]"
          >
            <option value="">All</option>
            <option value="expense">Expense</option>
            <option value="mileage">Mileage</option>
            <option value="income">Income</option>
            <option value="trip">Trip</option>
            <option value="reconciliation">Reconciliation</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading audit log...</p>
      ) : logs.length === 0 ? (
        <div className="card text-center text-sm text-muted-foreground">No audit entries found.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap text-sm">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td>
                    {log.user
                      ? log.user.firstName
                        ? `${log.user.firstName} ${log.user.lastName ?? ""}`
                        : log.user.email
                      : "System"}
                  </td>
                  <td className="capitalize">{log.action.replace(/_/g, " ")}</td>
                  <td className="capitalize">{log.entityType}</td>
                  <td className="font-mono text-xs text-muted-foreground">
                    {log.entityId.slice(0, 10)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
