import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { getToken, getUser, type MobileUser } from "../src/lib/auth";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [user, setUser] = useState<MobileUser | null>(null);

  useEffect(() => {
    Promise.all([getToken(), getUser()]).then(([token, savedUser]) => {
      setHasToken(!!token);
      setUser(savedUser);
      setReady(true);
    });
  }, []);

  if (!ready) return null;

  if (!hasToken || !user) return <Redirect href="/login" />;
  return user.role === "fielder"
    ? <Redirect href="/(tabs)/jobs" />
    : <Redirect href="/(tabs)/monitor" />;
}
