import { prisma } from "./prisma";
import {
  resolveClientRate,
  resolveFielderRate,
  toNumber,
  type ResolvedClientRate,
  type ResolvedFielderRate,
} from "@uln/shared";

export async function getStateRate(state: string) {
  return prisma.stateRate.findUnique({ where: { state } });
}

export async function resolveRatesForProject(
  clientId?: string | null,
  state?: string | null
): Promise<{ client: ResolvedClientRate; fielder: ResolvedFielderRate }> {
  const [client, stateRate] = await Promise.all([
    clientId ? prisma.client.findUnique({ where: { id: clientId } }) : null,
    state ? getStateRate(state) : null,
  ]);

  const ctx = {
    clientRate: client ? toNumber(client.defaultSqftRate) : null,
    stateClientRate: stateRate ? toNumber(stateRate.clientSqftRate) : null,
    stateFielderRate: stateRate ? toNumber(stateRate.fielderSqftRate) : null,
  };

  return {
    client: resolveClientRate(ctx),
    fielder: resolveFielderRate(ctx),
  };
}

export async function resolveFielderRateForAssignment(
  fielderId: string,
  projectState?: string | null
): Promise<ResolvedFielderRate> {
  const [fielder, stateRate] = await Promise.all([
    prisma.fielder.findUnique({ where: { id: fielderId } }),
    projectState ? getStateRate(projectState) : null,
  ]);

  return resolveFielderRate({
    fielderRate: fielder ? toNumber(fielder.defaultSqftRate) : null,
    stateFielderRate: stateRate ? toNumber(stateRate.fielderSqftRate) : null,
  });
}
