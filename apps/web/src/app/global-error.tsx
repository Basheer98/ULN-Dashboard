"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#fafafa" }}>
        <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
          <p style={{ color: "#a3a3a3", marginBottom: "1.5rem" }}>
            The app hit an unexpected error. Your data is safe — try reloading this page.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "0.625rem 1.25rem",
              borderRadius: 8,
              border: "none",
              background: "#fafafa",
              color: "#0a0a0a",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {process.env.NODE_ENV === "development" && error.message ? (
            <pre
              style={{
                marginTop: "2rem",
                padding: "1rem",
                textAlign: "left",
                fontSize: "0.75rem",
                background: "#171717",
                borderRadius: 8,
                overflow: "auto",
              }}
            >
              {error.message}
            </pre>
          ) : null}
        </main>
      </body>
    </html>
  );
}
