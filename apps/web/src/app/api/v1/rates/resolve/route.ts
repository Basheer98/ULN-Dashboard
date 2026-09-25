import { NextRequest } from "next/server";
import { canViewProjectFinancials } from "@uln/shared";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser } from "@/lib/api";
import { resolveRatesForProject, resolveFielderRateForAssignment } from "@/lib/rates";

export async function GET(request: NextRequest) {
  try {
    const user = requireOfficeUser(await getRequestUser(request));
    if (!canViewProjectFinancials(user.role)) {
      return jsonError("Forbidden", 403);
    }

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
