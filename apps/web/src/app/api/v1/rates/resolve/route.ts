import { NextRequest } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonOk, requireOfficeUser } from "@/lib/api";
import { resolveRatesForProject, resolveFielderRateForAssignment } from "@/lib/rates";

export async function GET(request: NextRequest) {
  try {
    requireOfficeUser(await getRequestUser(request));
    const { searchParams } = request.nextUrl;
    const clientId = searchParams.get("clientId");
    const state = searchParams.get("state");
    const fielderId = searchParams.get("fielderId");

    const rates = await resolveRatesForProject(clientId, state);

    if (fielderId) {
      const fielder = await resolveFielderRateForAssignment(fielderId, state);
      return jsonOk({ ...rates, fielder });
    }

    return jsonOk(rates);
  } catch (error) {
    return handleApiError(error);
  }
}
