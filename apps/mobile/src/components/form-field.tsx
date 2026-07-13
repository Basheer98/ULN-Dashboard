import type { ReactNode } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { layout, screenStyles } from "../lib/layout";
import { colors } from "../lib/theme";
import { fonts } from "../lib/fonts";

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad" | "decimal-pad";
  editable?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={[
          screenStyles.input,
          multiline && styles.multiline,
          !editable && styles.disabled,
        ]}
        multiline={multiline}
        keyboardType={keyboardType}
        editable={editable}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
      />
    </View>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  multiline: {
    minHeight: 96,
    paddingTop: Platform.OS === "ios" ? 13 : 10,
    textAlignVertical: "top",
  },
  disabled: { opacity: 0.6 },
  section: { marginTop: 8 },
  sectionTitle: {
    fontFamily: fonts.bold,
    color: colors.mutedForeground,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
    marginTop: 8,
  },
});
