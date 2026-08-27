import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiRequest } from "../lib/api";
import { getToken } from "../lib/auth";
import { colors, getStatusColor } from "../lib/theme";
import { fonts } from "../lib/fonts";
import { layout, screenStyles } from "../lib/layout";

export interface ExpenseListItem {
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

export function useMyExpenses() {
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
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
        apiRequest<ExpenseListItem[]>("/finance/expenses/mine", { token }),
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

  return {
    expenses,
    summary,
    loading,
    refreshing,
    refresh: () => {
      setRefreshing(true);
      void loadExpenses();
    },
  };
}

export function ExpenseListBody({
  expenses,
  summary,
  loading,
  refreshing,
  onRefresh,
  listHeader,
}: {
  expenses: ExpenseListItem[];
  summary: ReimbSummary | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  listHeader?: ReactNode;
}) {
  if (loading) {
    return (
      <View style={screenStyles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={expenses}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }
      ListHeaderComponent={
        <View>
          {listHeader}
          {summary ? (
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: colors.warning }]} numberOfLines={1}>
                  {formatMoney(summary.reimbursements.pendingAmount)}
                </Text>
                <Text style={styles.summaryLabel} numberOfLines={2}>
                  Pending ({summary.reimbursements.pendingCount})
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={[styles.summaryValue, { color: colors.success }]} numberOfLines={1}>
                  {formatMoney(summary.reimbursements.paidAmount)}
                </Text>
                <Text style={styles.summaryLabel} numberOfLines={1}>
                  Reimbursed
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No expenses submitted yet.</Text>}
      renderItem={({ item }) => {
        const status = item.expenseStatus ?? "submitted";
        const statusColor = getStatusColor(status);
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/expenses/${item.id}`)}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.amount} numberOfLines={1}>
                {formatMoney(Number(item.amount))}
              </Text>
              <View style={[styles.badge, { backgroundColor: `${statusColor}22` }]}>
                <Text style={[styles.badgeText, { color: statusColor }]} numberOfLines={1}>
                  {status.replace(/_/g, " ")}
                </Text>
              </View>
            </View>
            <Text style={styles.desc} numberOfLines={2}>
              {item.description || "No description"}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
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
  );
}

const styles = StyleSheet.create({
  list: {
    ...screenStyles.list,
    flexGrow: 1,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: layout.gridGap,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: layout.borderRadiusSm,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  summaryValue: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  summaryLabel: {
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  empty: {
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
    textAlign: "center",
    marginTop: 48,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: layout.borderRadius,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  amount: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bold,
    color: colors.foreground,
    fontSize: 20,
    lineHeight: 26,
  },
  badge: {
    flexShrink: 0,
    maxWidth: "48%",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    textTransform: "capitalize",
  },
  desc: {
    fontFamily: fonts.medium,
    color: colors.foreground,
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  meta: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  date: {
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
});
