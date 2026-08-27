import Constants from "expo-constants";

/**
 * Prefer the same host Expo Go used to load the JS bundle.
 * That stays in sync when your Mac's Wi‑Fi IP changes.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();

  // Production / remote API — always honor env
  if (fromEnv?.startsWith("https://")) {
    return fromEnv.replace(/\/$/, "");
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
    null;

  if (hostUri) {
    const host = hostUri.split(":")[0]?.trim();
    // LAN IP / hostname from Expo — reuse for Next.js on port 3000
    if (
      host &&
      host !== "localhost" &&
      host !== "127.0.0.1" &&
      !host.includes("exp.direct") &&
      !host.includes("expo.dev") &&
      !host.includes("ngrok")
    ) {
      return `http://${host}:3000/api/v1`;
    }
  }

  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:3000/api/v1";
}

const API_URL = resolveApiUrl();

const REQUEST_TIMEOUT_MS = 12000;

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const isFormData = rest.body instanceof FormData;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
      },
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new ApiError(
      aborted
        ? `Server timed out.\n${API_URL}\n\nFix: Mac + phone on same Wi‑Fi, npm run dev running, Settings → Expo Go → Local Network ON. Then reload the app.`
        : `Network error.\n${API_URL}\n\nCannot reach the API from this phone.`
    );
  } finally {
    clearTimeout(timeout);
  }

  let data: { error?: string };
  try {
    data = await res.json();
  } catch {
    throw new ApiError(
      res.ok ? "Invalid server response" : `Request failed (${res.status})`,
      res.status
    );
  }

  if (!res.ok) {
    if (res.status === 401) {
      const { clearSession } = await import("./auth");
      await clearSession();
      throw new ApiError("Session expired. Please sign in again.", 401);
    }
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export async function registerPushToken(token: string, pushToken: string) {
  return apiRequest("/auth/push-token", {
    method: "POST",
    token,
    body: JSON.stringify({ pushToken }),
  });
}

/** Dev helper — ping /api/health (via parent path). */
export async function testApiConnection(): Promise<{ ok: boolean; detail: string }> {
  const healthUrl = API_URL.replace(/\/api\/v1\/?$/, "/api/health");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { ok: false, detail: `Health HTTP ${res.status}` };
    return { ok: true, detail: `OK — ${healthUrl}` };
  } catch (err) {
    clearTimeout(timeout);
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      detail: aborted ? `Timeout — ${healthUrl}` : `Unreachable — ${healthUrl}`,
    };
  }
}

export { API_URL };
