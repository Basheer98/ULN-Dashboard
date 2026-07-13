import { View, Text, StyleSheet } from "react-native";
import { colors } from "../lib/theme";
import { fonts } from "../lib/fonts";

interface Week {
  label: string;
  amount: number;
}

interface Props {
  weeks: Week[];
  height?: number;
}

function formatMoney(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return n > 0 ? `$${Math.round(n)}` : "";
}

export function WeeklyEarningsChart({ weeks, height = 160 }: Props) {
  const max = Math.max(...weeks.map((w) => w.amount), 1);
  const chartHeight = height - 48;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weekly Earnings</Text>
      <View style={[styles.chart, { height }]}>
        {weeks.map((week) => {
          const barHeight =
            week.amount > 0
              ? Math.max((week.amount / max) * chartHeight, 6)
              : 2;
          return (
            <View key={week.label + week.amount} style={styles.barCol}>
              <Text style={styles.barAmount} numberOfLines={1}>
                {formatMoney(week.amount)}
              </Text>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: barHeight }]} />
              </View>
              <Text style={styles.barLabel} numberOfLines={1}>
                {week.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.mutedForeground,
    letterSpacing: 0.4,
    marginBottom: 16,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
  },
  barAmount: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 9,
    height: 14,
    marginBottom: 4,
    textAlign: "center",
  },
  barTrack: {
    height: 100,
    justifyContent: "flex-end",
    width: "100%",
    alignItems: "center",
  },
  bar: {
    width: "72%",
    maxWidth: 28,
    backgroundColor: colors.accent,
    borderRadius: 4,
    minWidth: 6,
  },
  barLabel: {
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
    fontSize: 9,
    marginTop: 8,
    textAlign: "center",
  },
});
