"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function InvoicesFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/invoices?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label">From</label>
        <input
          type="date"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)}
          className="w-full sm:w-auto"
        />
      </div>
      <div>
        <label className="label">To</label>
        <input
          type="date"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)}
          className="w-full sm:w-auto"
        />
      </div>
      {(searchParams.get("from") || searchParams.get("to")) && (
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("from");
            params.delete("to");
            router.push(`/invoices?${params.toString()}`);
          }}
        >
          Clear dates
        </button>
      )}
    </div>
  );
}
