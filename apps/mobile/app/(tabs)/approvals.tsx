import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getToken } from "../../src/lib/auth";
import {
  actOnApproval,
  loadOfficeSummary,
  type OfficeApproval,
  type OfficeSummary,
} from "../../src/lib/office";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";
import { screenStyles } from "../../src/lib/layout";

type Filter = "all" | "expense" | "mileage" | "payment";

export default function ApprovalsScreen() {
  const [data, setData] = useState<OfficeSummary | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return router.replace("/login");
    try {
      setData(await loadOfficeSummary(token));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

  const items = useMemo(() => {
    const all = [
      ...(data?.approvals.expenses ?? []),
      ...(data?.approvals.mileage ?? []),
      ...(data?.approvals.payments ?? []),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filter === "all" ? all : all.filter((item) => item.type === filter);
  }, [data, filter]);

  async function perform(item: OfficeApproval, action: "approve" | "reject" | "paid") {
    const token = await getToken();
    if (!token) return;
    setBusyId(item.id);
    try {
      await actOnApproval(token, item, action);
      await load();
    } catch (error) {
      Alert.alert("Action failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  function confirmReject(item: OfficeApproval) {
    Alert.alert("Reject item?", `Reject ${item.subtitle}'s ${item.type}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: () => perform(item, "reject") },
    ]);
  }

  if (loading) {
    return (
      <View style={screenStyles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={screenStyles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Approvals</Text>
        <Text style={styles.subtitle}>{items.length} item{items.length === 1 ? "" : "s"} waiting</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {(["all", "expense", "mileage", "payment"] as Filter[]).map((value) => (
            <TouchableOpacity
              key={value}
              style={[styles.filter, filter === value && styles.filterActive]}
              onPress={() => setFilter(value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
                {value === "all" ? "All" : `${value[0].toUpperCase()}${value.slice(1)}`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerStyle={screenStyles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListEmptyComponent={<Text style={styles.empty}>No approvals waiting.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.typePill}>
                <Text style={styles.typeText}>{item.type}</Text>
              </View>
              <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.subtitleText}>
              {item.subtitle}
              {item.category ? ` · ${item.category}` : ""}
            </Text>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>

            <View style={styles.actions}>
              {item.type !== "payment" ? (
                <TouchableOpacity
                  style={styles.rejectButton}
                  disabled={busyId === item.id}
                  onPress={() => confirmReject(item)}
                >
                  <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.approveButton}
                disabled={busyId === item.id}
                onPress={() =>
                  perform(
                    item,
                    item.type === "payment" && item.status === "approved"
                      ? "paid"
                      : "approve"
                  )
                }
              >
                {busyId === item.id ? (
                  <ActivityIndicator color={colors.accentForeground} />
                ) : (
                  <Text style={styles.approveText}>
                    {item.type === "payment"
                      ? item.status === "approved"
                        ? "Mark paid"
                        : "Approve payment"
                      : "Approve"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

function formatMoney(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const styles = StyleSheet.create({
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 22, lineHeight: 28 },
  subtitle: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  filters: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingRight: 16 },
  filter: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  filterActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { fontFamily: fonts.medium, color: colors.muted, fontSize: 12, lineHeight: 16 },
  filterTextActive: { color: colors.accentForeground },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 11,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  typePill: {
    backgroundColor: `${colors.info}20`,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  typeText: {
    fontFamily: fonts.semibold,
    color: colors.info,
    fontSize: 10,
    lineHeight: 14,
    textTransform: "uppercase",
  },
  amount: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 19, lineHeight: 24 },
  cardTitle: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 15, lineHeight: 20, marginTop: 10 },
  subtitleText: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  date: { fontFamily: fonts.regular, color: colors.mutedForeground, fontSize: 11, lineHeight: 14, marginTop: 5 },
  actions: { flexDirection: "row", alignItems: "stretch", gap: 9, marginTop: 14 },
  rejectButton: {
    flex: 1,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 9,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  rejectText: { fontFamily: fonts.semibold, color: colors.danger, fontSize: 12, lineHeight: 16 },
  approveButton: {
    flex: 1.4,
    backgroundColor: colors.accent,
    borderRadius: 9,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  approveText: { fontFamily: fonts.semibold, color: colors.accentForeground, fontSize: 12, lineHeight: 16, textAlign: "center" },
  empty: { fontFamily: fonts.regular, color: colors.mutedForeground, textAlign: "center", marginTop: 60, lineHeight: 20 },
});
