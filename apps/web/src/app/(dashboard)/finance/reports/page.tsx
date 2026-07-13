import { FinanceHeader } from "@/components/finance/finance-nav";
import { FinanceReportExports } from "@/components/finance-report-exports";

export default function FinanceReportsPage() {
  return (
    <>
      <FinanceHeader title="Finance Reports" subtitle="Export financial reports as CSV" />
      <main className="page-main space-y-6">
        <div className="card">
          <p className="text-sm text-muted-foreground">
            Choose a date range, then download any report below as CSV.
          </p>
        </div>
        <FinanceReportExports />
      </main>
    </>
  );
}
