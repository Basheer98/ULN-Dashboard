import { StyleSheet, Text, View } from "react-native";
import { fonts } from "../lib/fonts";

export function StatusBadge({
  label,
  color,
  compact,
}: {
  label: string;
  color: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.badge, compact && styles.badgeCompact, { backgroundColor: `${color}22` }]}>
      <Text style={[styles.text, compact && styles.textCompact, { color }]} numberOfLines={1}>
        {label.replace(/_/g, " ")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  text: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    lineHeight: 14,
    textTransform: "capitalize",
  },
  textCompact: {
    fontSize: 9,
    lineHeight: 12,
  },
});
