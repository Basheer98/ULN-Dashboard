import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiRequest } from "../../src/lib/api";
import { getToken } from "../../src/lib/auth";
import { colors, getStatusColor } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";

interface Expense {
  id: string;
  transactionNumber: string;
  transactionDate: string;
  amount: number;
  description: string | null;
  expenseStatus: string | null;
  category: { name: string } | null;
  project: { projectNumber: string } | null;
}

interface ReimbSummary {
  reimbursements: { pendingCount: number; pendingAmount: number; paidAmount: number };
}

function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ReimbSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadExpenses = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const [data, profile] = await Promise.all([
        apiRequest<Expense[]>("/finance/expenses/mine", { token }),
        apiRequest<ReimbSummary>("/fielders/me", { token }),
      ]);
      setExpenses(data);
      setSummary(profile);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadExpenses();
    }, [loadExpenses])
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>My Expenses</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push("/expenses/new")}
        >
          <Text style={styles.addBtnText}>+ Submit</Text>
        </TouchableOpacity>
      </View>

      {summary && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>
              {formatMoney(summary.reimbursements.pendingAmount)}
            </Text>
            <Text style={styles.summaryLabel}>
              Pending ({summary.reimbursements.pendingCount})
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {formatMoney(summary.reimbursements.paidAmount)}
            </Text>
            <Text style={styles.summaryLabel}>Reimbursed</Text>
          </View>
        </View>
      )}

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadExpenses();
            }}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No expenses submitted yet.</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const status = item.expenseStatus ?? "submitted";
          const statusColor = getStatusColor(status);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/expenses/${item.id}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.amount}>${Number(item.amount).toFixed(2)}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor + "22" }]}>
                  <Text style={[styles.badgeText, { color: statusColor }]}>
                    {status.replace(/_/g, " ")}
                  </Text>
                </View>
              </View>
              <Text style={styles.desc}>{item.description || "No description"}</Text>
              <Text style={styles.meta}>
                {item.category?.name ?? "Uncategorized"}
                {item.project ? ` · ${item.project.projectNumber}` : ""}
              </Text>
              <Text style={styles.date}>
                {new Date(item.transactionDate).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 18 },
  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { fontFamily: fonts.semibold, color: colors.accentForeground, fontSize: 14 },
  summaryRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryValue: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 16 },
  summaryLabel: { fontFamily: fonts.regular, color: colors.mutedForeground, fontSize: 10, marginTop: 2 },
  empty: { fontFamily: fonts.regular, color: colors.mutedForeground, textAlign: "center", marginTop: 40 },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  amount: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 20 },
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 12, textTransform: "capitalize" },
  desc: { fontFamily: fonts.medium, color: colors.foreground, fontSize: 15, marginBottom: 4 },
  meta: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13 },
  date: { fontFamily: fonts.regular, color: colors.mutedForeground, fontSize: 12, marginTop: 6 },
});
