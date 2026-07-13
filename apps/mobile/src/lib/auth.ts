import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "uln_access_token";
const USER_KEY = "uln_user";

export interface MobileUser {
  id: string;
  email: string;
  role: string;
  fielderId: string | null;
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
