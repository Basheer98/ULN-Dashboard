import * as Sentry from "@sentry/react-native";

let initialized = false;

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,
    environment: __DEV__ ? "development" : "production",
    enableAutoSessionTracking: true,
  });
  initialized = true;
}

export function captureError(error: unknown) {
  if (initialized) {
    Sentry.captureException(error);
  }
}

export { Sentry };
