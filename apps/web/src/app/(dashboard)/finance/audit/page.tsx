import { FinanceHeader } from "@/components/finance/finance-nav";
import { AuditLogViewer } from "@/components/audit-log-viewer";

export default function AuditLogPage() {
  return (
    <>
      <FinanceHeader title="Audit Log" subtitle="Finance change history" />
      <main className="page-main">
        <AuditLogViewer />
      </main>
    </>
  );
}
