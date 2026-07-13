import { StyleSheet, Text, View } from "react-native";
import { layout } from "../lib/layout";
import { colors } from "../lib/theme";
import { fonts } from "../lib/fonts";

export function MetricGrid({
  items,
}: {
  items: Array<{ label: string; value: string | number; color?: string }>;
}) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={styles.cell}>
          <View style={styles.card}>
            <Text style={[styles.value, item.color ? { color: item.color } : null]} numberOfLines={1}>
              {item.value}
            </Text>
            <Text style={styles.label} numberOfLines={2}>
              {item.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -layout.gridGap / 2,
    marginTop: 4,
  },
  cell: {
    width: "50%",
    paddingHorizontal: layout.gridGap / 2,
    marginBottom: layout.gridGap,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: layout.borderRadius,
    padding: 14,
    minHeight: 76,
    justifyContent: "center",
  },
  value: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.foreground,
  },
  label: {
    fontFamily: fonts.medium,
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
});
