"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("Dashboard error:", error);
  }, [error]);

  const message = error?.message || "Unknown error";
  const looksLikeSchema =
    /does not exist|Unknown column|Unknown arg|column .* required|enum/i.test(message);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-xl font-semibold text-foreground">This page failed to load</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {looksLikeSchema
          ? "The database schema is out of date (missing columns/tables). Run migrations on Railway, then reload."
          : "An error occurred while loading this section. Other parts of the dashboard should still work."}
      </p>
      {message ? (
        <pre className="mt-4 max-w-xl overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs text-danger">
          {message}
          {error.digest ? `\nDigest: ${error.digest}` : ""}
        </pre>
      ) : null}
      {looksLikeSchema ? (
        <p className="mt-3 max-w-lg text-xs text-muted-foreground">
          Check{" "}
          <a href="/api/health/db" className="link">
            /api/health/db
          </a>{" "}
          then in Railway Shell run:{" "}
          <code className="text-foreground">npm run db:migrate:deploy</code>
        </p>
      ) : null}
      <button type="button" className="btn-primary mt-6" onClick={() => reset()}>
        Reload page
      </button>
    </div>
  );
}
