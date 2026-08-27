import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { apiRequest, API_URL, testApiConnection } from "../src/lib/api";
import {
  getRememberedEmail,
  getValidSession,
  homeRouteForUser,
  isBiometricsEnabled,
  markBiometricsPrompted,
  saveRememberedEmail,
  saveSession,
  setBiometricsEnabled,
  wasBiometricsPrompted,
  type MobileUser,
} from "../src/lib/auth";
import {
  authenticateWithBiometrics,
  canUseBiometrics,
  getBiometricLabel,
} from "../src/lib/biometrics";
import { colors } from "../src/lib/theme";
import { fonts } from "../src/lib/fonts";
import { layout, screenStyles } from "../src/lib/layout";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [ready, setReady] = useState(false);
  const [unlockAvailable, setUnlockAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Face ID");
  const unlocking = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [savedEmail, session, bioOn, canUse, label] = await Promise.all([
        getRememberedEmail(),
        getValidSession(),
        isBiometricsEnabled(),
        canUseBiometrics(),
        getBiometricLabel(),
      ]);
      if (cancelled) return;

      if (savedEmail) setEmail(savedEmail);
      setBiometricLabel(label);
      const canUnlock = Boolean(session && bioOn && canUse);
      setUnlockAvailable(canUnlock);
      setReady(true);
      if (canUnlock) {
        void unlockWithBiometrics(session!.user, label);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  async function unlockWithBiometrics(user?: MobileUser, label = biometricLabel) {
    if (unlocking.current) return;
    unlocking.current = true;
    setError("");
    try {
      const session = user ? { user } : await getValidSession();
      if (!session) {
        setUnlockAvailable(false);
        return;
      }
      const ok = await authenticateWithBiometrics(`Unlock ULN with ${label}`);
      if (!ok) return;
      const { setupPushNotifications } = await import("../src/lib/push");
      setupPushNotifications().catch(() => {});
      router.replace(homeRouteForUser(session.user));
    } catch (e) {
      setError(e instanceof Error ? e.message : `${biometricLabel} unlock failed`);
    } finally {
      unlocking.current = false;
    }
  }

  async function maybeEnableBiometrics() {
    const [canUse, alreadyOn, prompted] = await Promise.all([
      canUseBiometrics(),
      isBiometricsEnabled(),
      wasBiometricsPrompted(),
    ]);
    if (!canUse || alreadyOn || prompted) return;

    const label = await getBiometricLabel();
    await new Promise<void>((resolve) => {
      Alert.alert(
        `Use ${label} next time?`,
        `Unlock ULN with ${label} instead of typing your password.`,
        [
          {
            text: "Not now",
            style: "cancel",
            onPress: () => {
              void markBiometricsPrompted().finally(resolve);
            },
          },
          {
            text: `Enable ${label}`,
            onPress: () => {
              void (async () => {
                const ok = await authenticateWithBiometrics(`Enable ${label} for ULN`);
                await setBiometricsEnabled(ok);
                if (!ok) await markBiometricsPrompted();
                resolve();
              })();
            },
          },
        ]
      );
    });
  }

  async function handleLogin() {
    setError("");
    setLoading(true);

    try {
      const data = await apiRequest<{ accessToken: string; user: MobileUser }>(
        "/auth/login",
        {
          method: "POST",
          headers: { "X-Client": "mobile" },
          body: JSON.stringify({ email, password }),
        }
      );

      await saveSession(data.accessToken, data.user);
      await saveRememberedEmail(rememberEmail ? email : null);
      await maybeEnableBiometrics();
      const { setupPushNotifications } = await import("../src/lib/push");
      setupPushNotifications().catch(() => {});
      router.replace(homeRouteForUser(data.user));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setError("");
    const result = await testApiConnection();
    setTesting(false);
    setError(result.ok ? result.detail : `Connection failed\n${result.detail}`);
  }

  if (!ready) {
    return (
      <View style={screenStyles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[screenStyles.center, styles.page]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>ULN</Text>
        <Text style={styles.title}>Urbanlink Networks</Text>
        <Text style={styles.subtitle}>Operations & Field App</Text>

        {unlockAvailable ? (
          <>
            <Text style={styles.welcome}>Welcome back</Text>
            {email ? <Text style={styles.welcomeEmail}>{email}</Text> : null}
            <TouchableOpacity
              style={styles.bioButton}
              onPress={() => void unlockWithBiometrics()}
              disabled={loading}
            >
              <Ionicons name="scan-outline" size={22} color={colors.accentForeground} />
              <Text style={styles.buttonText}>Unlock with {biometricLabel}</Text>
            </TouchableOpacity>
            <Text style={styles.orText}>or sign in with password</Text>
          </>
        ) : null}

        <TextInput
          style={screenStyles.input}
          placeholder="Email"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[screenStyles.input, styles.inputSpacing]}
          placeholder="Password"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={styles.rememberRow}
          onPress={() => setRememberEmail((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: rememberEmail }}
        >
          <View style={[styles.checkbox, rememberEmail && styles.checkboxOn]}>
            {rememberEmail ? (
              <Ionicons name="checkmark" size={14} color={colors.accentForeground} />
            ) : null}
          </View>
          <Text style={styles.rememberText}>Remember email on this phone</Text>
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.accentForeground} />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {__DEV__ && (
          <>
            <Text style={styles.apiHint} selectable>
              API: {API_URL}
            </Text>
            <TouchableOpacity
              style={styles.testButton}
              onPress={handleTestConnection}
              disabled={testing || loading}
            >
              <Text style={styles.testButtonText}>
                {testing ? "Testing…" : "Test API connection"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24 },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: layout.borderRadius + 4,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brand: {
    fontFamily: fonts.bold,
    color: colors.accent,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
    fontSize: 22,
    lineHeight: 28,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  welcome: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
    fontSize: 16,
    lineHeight: 22,
  },
  welcomeEmail: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 12,
  },
  bioButton: {
    backgroundColor: colors.accent,
    borderRadius: layout.borderRadiusSm,
    minHeight: layout.buttonMinHeight,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  orText: {
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 12,
  },
  inputSpacing: { marginTop: 12 },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  rememberText: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: layout.borderRadiusSm,
    minHeight: layout.buttonMinHeight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingHorizontal: 16,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    fontFamily: fonts.semibold,
    color: colors.accentForeground,
    fontSize: 16,
    lineHeight: 20,
  },
  error: {
    fontFamily: fonts.regular,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    textAlign: "center",
  },
  apiHint: {
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 16,
    textAlign: "center",
  },
  testButton: {
    marginTop: 10,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  testButtonText: {
    fontFamily: fonts.medium,
    color: colors.accent,
    fontSize: 13,
  },
});
