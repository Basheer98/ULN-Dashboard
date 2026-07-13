import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ReactNode } from "react";
import { textStyles, screenStyles } from "../lib/layout";
import { colors } from "../lib/theme";
import { fonts } from "../lib/fonts";

export function ScreenHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={screenStyles.headerRow}>
      <View style={screenStyles.headerText}>
        <Text style={textStyles.heading}>{title}</Text>
        {subtitle ? <Text style={textStyles.subheading}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function IconActionButton({
  onPress,
  children,
}: {
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.iconBtn} onPress={onPress} activeOpacity={0.8}>
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
