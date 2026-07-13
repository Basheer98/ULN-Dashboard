import { z } from "zod";

/** Company-wide default SQFT rates (USD per SQFT). */
export const DEFAULT_CLIENT_SQFT_RATE = 0.03;
export const DEFAULT_FIELDER_SQFT_RATE = 0.015;

export type RateSource = "manual" | "client" | "state" | "fielder" | "default";

export interface ResolvedClientRate {
  clientSqftRate: number;
  source: RateSource;
  label: string;
}

export interface ResolvedFielderRate {
  fielderSqftRate: number;
  source: RateSource;
  label: string;
}

export interface RateContext {
  clientRate?: number | null;
  stateClientRate?: number | null;
  stateFielderRate?: number | null;
  fielderRate?: number | null;
}

export function resolveClientRate(ctx: RateContext): ResolvedClientRate {
  if (ctx.clientRate != null && ctx.clientRate > 0) {
    return {
      clientSqftRate: ctx.clientRate,
      source: "client",
      label: "Client default rate",
    };
  }
  if (ctx.stateClientRate != null && ctx.stateClientRate > 0) {
    return {
      clientSqftRate: ctx.stateClientRate,
      source: "state",
      label: "State rate override",
    };
  }
  return {
    clientSqftRate: DEFAULT_CLIENT_SQFT_RATE,
    source: "default",
    label: "Company default ($0.030 / SQFT)",
  };
}

export function resolveFielderRate(ctx: RateContext): ResolvedFielderRate {
  if (ctx.fielderRate != null && ctx.fielderRate > 0) {
    return {
      fielderSqftRate: ctx.fielderRate,
      source: "fielder",
      label: "Fielder default rate",
    };
  }
  if (ctx.stateFielderRate != null && ctx.stateFielderRate > 0) {
    return {
      fielderSqftRate: ctx.stateFielderRate,
      source: "state",
      label: "State rate override",
    };
  }
  return {
    fielderSqftRate: DEFAULT_FIELDER_SQFT_RATE,
    source: "default",
    label: "Company default ($0.015 / SQFT)",
  };
}

export const stateRateSchema = z.object({
  state: z.string().length(2, "Use 2-letter state code"),
  clientSqftRate: z.coerce.number().min(0),
  fielderSqftRate: z.coerce.number().min(0),
  notes: z.string().optional(),
});

export type StateRateInput = z.infer<typeof stateRateSchema>;
