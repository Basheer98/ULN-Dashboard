import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getToken } from "../../src/lib/auth";
import { loadFinanceDashboard } from "../../src/lib/admin-api";
import { MetricGrid } from "../../src/components/metric-grid";
import { screenStyles, textStyles } from "../../src/lib/layout";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";

function money(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FinanceScreen() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof loadFinanceDashboard>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return router.replace("/login");
    try {
      setStats(await loadFinanceDashboard(token));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

  if (loading && !stats) {
    return (
      <View style={screenStyles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={screenStyles.container}
      contentContainerStyle={screenStyles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={() => { setRefreshing(true); load(); }} />
      }
    >
      <Text style={textStyles.heading}>Finance</Text>
      <Text style={textStyles.subheading}>Company financial overview</Text>

      <MetricGrid
        items={[
          { label: "Income", value: money(stats?.income ?? 0), color: colors.success },
          { label: "Expenses", value: money(stats?.expenses ?? 0), color: colors.danger },
          { label: "Net income", value: money(stats?.netIncome ?? 0), color: colors.accent },
          { label: "Outstanding invoices", value: money(stats?.outstandingInvoices ?? 0) },
          { label: "Pending reimbursements", value: String(stats?.pendingReimbursements ?? 0), color: colors.warning },
          { label: "Cash on hand", value: money(stats?.cashOnHand ?? 0) },
        ]}
      />

      <Text style={styles.section}>Quick actions</Text>
      <TouchableOpacity style={styles.card} onPress={() => router.push("/expenses/new")}>
        <Text style={styles.cardTitle}>Add company spending</Text>
        <Text style={styles.cardDesc}>Record expense with receipt photo</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.card} onPress={() => router.push("/(tabs)/approvals")}>
        <Text style={styles.cardTitle}>Review approvals</Text>
        <Text style={styles.cardDesc}>Expenses, mileage, and fielder payments</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.card} onPress={() => router.push("/invoices")}>
        <Text style={styles.cardTitle}>Invoices</Text>
        <Text style={styles.cardDesc}>Client billing status</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.card} onPress={() => router.push("/payments")}>
        <Text style={styles.cardTitle}>Fielder payments</Text>
        <Text style={styles.cardDesc}>Payout queue and status</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 17, lineHeight: 22, marginTop: 24, marginBottom: 10 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 10 },
  cardTitle: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 15, lineHeight: 20 },
  cardDesc: { fontFamily: fonts.regular, color: colors.mutedForeground, fontSize: 13, lineHeight: 18, marginTop: 4 },
});
