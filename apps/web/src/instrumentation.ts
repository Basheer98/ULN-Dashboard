import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    try {
      const { ensureProductionSchema } = await import("./lib/ensure-schema");
      const result = await ensureProductionSchema();
      if (!result.ok) {
        console.error("[instrumentation] schema ensure reported failure", result.steps);
      }
    } catch (err) {
      console.error("[instrumentation] schema ensure crashed", err);
    }
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
