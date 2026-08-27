import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import {
  getValidSession,
  homeRouteForUser,
  isBiometricsEnabled,
  type MobileUser,
} from "../src/lib/auth";
import { canUseBiometrics } from "../src/lib/biometrics";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<MobileUser | null>(null);
  const [needsUnlock, setNeedsUnlock] = useState(false);

  useEffect(() => {
    Promise.all([getValidSession(), isBiometricsEnabled(), canUseBiometrics()]).then(
      ([session, bioOn, canUse]) => {
        setUser(session?.user ?? null);
        setNeedsUnlock(Boolean(session && bioOn && canUse));
        setReady(true);
      }
    );
  }, []);

  if (!ready) return null;
  if (!user || needsUnlock) return <Redirect href="/login" />;
  return <Redirect href={homeRouteForUser(user)} />;
}
