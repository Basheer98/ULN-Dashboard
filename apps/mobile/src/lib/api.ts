const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

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

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
      },
    });
  } catch {
    throw new ApiError("Network error — check your connection and try again.");
  }

  let data: { error?: string };
  try {
    data = await res.json();
  } catch {
    throw new ApiError(res.ok ? "Invalid server response" : `Request failed (${res.status})`, res.status);
  }

  if (!res.ok) {
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

export { API_URL };
