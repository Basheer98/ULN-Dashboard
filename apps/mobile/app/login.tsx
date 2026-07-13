import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { apiRequest } from "../src/lib/api";
import { saveSession, MobileUser } from "../src/lib/auth";
import { colors } from "../src/lib/theme";
import { fonts } from "../src/lib/fonts";
import { layout, screenStyles } from "../src/lib/layout";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      const { setupPushNotifications } = await import("../src/lib/push");
      setupPushNotifications().catch(() => {});
      router.replace(
        data.user.role === "fielder" ? "/(tabs)/jobs" : "/(tabs)/monitor"
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
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

        <TextInput
          style={screenStyles.input}
          placeholder="Email"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[screenStyles.input, styles.inputSpacing]}
          placeholder="Password"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

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
  inputSpacing: { marginTop: 12 },
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
  buttonText: { fontFamily: fonts.semibold, color: colors.accentForeground, fontSize: 16, lineHeight: 20 },
  error: {
    fontFamily: fonts.regular,
    color: colors.danger,
    fontSize: 14,
    lineHeight: 18,
    marginTop: 8,
    textAlign: "center",
  },
});
