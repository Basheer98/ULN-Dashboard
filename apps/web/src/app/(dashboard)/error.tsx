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

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-xl font-semibold text-foreground">This page failed to load</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        An error occurred while loading this section. Other parts of the dashboard should still work.
      </p>
      <button type="button" className="btn btn-primary mt-6" onClick={() => reset()}>
        Reload page
      </button>
    </div>
  );
}
