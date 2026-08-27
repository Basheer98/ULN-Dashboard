import { useCallback, useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  isBiometricsEnabled,
  setBiometricsEnabled,
} from "../lib/auth";
import {
  authenticateWithBiometrics,
  canUseBiometrics,
  getBiometricLabel,
} from "../lib/biometrics";
import { colors } from "../lib/theme";
import { fonts } from "../lib/fonts";

export function AccountSecuritySection() {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState("Face ID");
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([canUseBiometrics(), isBiometricsEnabled(), getBiometricLabel()]).then(
        ([canUse, isOn, nextLabel]) => {
          if (!active) return;
          setAvailable(canUse);
          setEnabled(isOn);
          setLabel(nextLabel);
        }
      );
      return () => {
        active = false;
      };
    }, [])
  );

  async function toggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        const ok = await authenticateWithBiometrics(`Enable ${label} for ULN`);
        if (!ok) return;
        await setBiometricsEnabled(true);
        setEnabled(true);
        return;
      }
      await setBiometricsEnabled(false);
      setEnabled(false);
    } catch (error) {
      Alert.alert("Could not update", error instanceof Error ? error.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!available) return null;

  return (
    <>
      <Text style={styles.sectionLabel}>Security</Text>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>Unlock with {label}</Text>
          <Text style={styles.desc}>
            Sign in on this phone without typing your password
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          disabled={busy}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.foreground}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: fonts.bold,
    color: colors.mutedForeground,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
    fontSize: 16,
  },
  desc: {
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
    fontSize: 13,
    marginTop: 4,
  },
});
