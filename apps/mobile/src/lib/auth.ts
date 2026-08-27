import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "uln_access_token";
const USER_KEY = "uln_user";
const EMAIL_KEY = "uln_remember_email";
const BIOMETRICS_KEY = "uln_biometrics_enabled";
const BIOMETRICS_PROMPTED_KEY = "uln_biometrics_prompted";

export interface MobileUser {
  id: string;
  email: string;
  role: string;
  fielderId: string | null;
}

export function homeRouteForUser(user: MobileUser): "/(tabs)/jobs" | "/(tabs)/monitor" {
  return user.role === "fielder" ? "/(tabs)/jobs" : "/(tabs)/monitor";
}

export async function saveSession(token: string, user: MobileUser) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getUser(): Promise<MobileUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as MobileUser;
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function saveRememberedEmail(email: string | null) {
  if (!email) {
    await SecureStore.deleteItemAsync(EMAIL_KEY);
    return;
  }
  await SecureStore.setItemAsync(EMAIL_KEY, email.trim().toLowerCase());
}

export async function getRememberedEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(EMAIL_KEY);
}

export async function setBiometricsEnabled(enabled: boolean) {
  await SecureStore.setItemAsync(BIOMETRICS_KEY, enabled ? "true" : "false");
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRICS_PROMPTED_KEY, "true");
  }
}

export async function isBiometricsEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRICS_KEY)) === "true";
}

export async function wasBiometricsPrompted(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRICS_PROMPTED_KEY)) === "true";
}

export async function markBiometricsPrompted() {
  await SecureStore.setItemAsync(BIOMETRICS_PROMPTED_KEY, "true");
}

export function isAccessTokenExpired(token: string): boolean {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return true;
    const padded = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const json = globalThis.atob(padded);
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 <= Date.now() + 15_000;
  } catch {
    return true;
  }
}

export async function getValidSession(): Promise<{
  token: string;
  user: MobileUser;
} | null> {
  const [token, user] = await Promise.all([getToken(), getUser()]);
  if (!token || !user) return null;
  if (isAccessTokenExpired(token)) {
    await clearSession();
    return null;
  }
  return { token, user };
}
