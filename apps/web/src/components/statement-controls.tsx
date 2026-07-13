"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function StatementControls({ fielderId, month }: { fielderId: string; month: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setMonth(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", value);
    router.push(`/fielders/${fielderId}/statement?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Month</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>
      <button type="button" onClick={() => window.print()} className="btn-secondary">
        Print
      </button>
      <a href={`/api/v1/fielders/${fielderId}/statement?month=${month}`} className="btn-primary">
        Download PDF
      </a>
    </div>
  );
}
