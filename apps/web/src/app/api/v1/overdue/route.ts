import { NextRequest } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonOk, requireOfficeUser } from "@/lib/api";
import { serializeProject } from "@/lib/projects";
import { getOverdueItems } from "@/lib/overdue";

export async function GET(request: NextRequest) {
  try {
    requireOfficeUser(await getRequestUser(request));
    const data = await getOverdueItems();
    return jsonOk(serializeProject(data));
  } catch (error) {
    return handleApiError(error);
  }
}
