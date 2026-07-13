import { jsonOk } from "@/lib/api";

export async function GET() {
  return jsonOk({ status: "ok", service: "uln-dashboard", timestamp: new Date().toISOString() });
}
