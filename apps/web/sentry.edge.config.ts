import * as Sentry from "@sentry/nextjs";

const sentryDsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
    environment: process.env.NODE_ENV ?? "development",
  });
}

export {};
