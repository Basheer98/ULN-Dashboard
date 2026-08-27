import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { apiRequest } from "../src/lib/api";
import { getToken } from "../src/lib/auth";
import { colors, getStatusColor } from "../src/lib/theme";
import { fonts } from "../src/lib/fonts";

interface MileageEntry {
  id: string;
  date: string;
  totalMiles: number;
  reimbursement: number;
  status: string;
  startLocation: string | null;
  destination: string | null;
  startOdometer: number | null;
  endOdometer: number | null;
  photos?: Array<{ id: string; kind: string }>;
}

function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MileageHistoryScreen() {
  const [entries, setEntries] = useState<MileageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await apiRequest<MileageEntry[]>("/finance/mileage/mine", { token });
      setEntries(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No mileage entries yet.</Text>
        }
        renderItem={({ item }) => {
          const statusColor = getStatusColor(item.status);
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.amount}>{formatMoney(item.reimbursement)}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor + "22" }]}>
                  <Text style={[styles.badgeText, { color: statusColor }]}>
                    {item.status.replace(/_/g, " ")}
                  </Text>
                </View>
              </View>
              <Text style={styles.route}>
                {[item.startLocation, item.destination].filter(Boolean).join(" → ") || "Mileage trip"}
              </Text>
              <Text style={styles.meta}>
                {item.totalMiles.toFixed(1)} miles · {new Date(item.date).toLocaleDateString()}
              </Text>
              {item.startOdometer != null && item.endOdometer != null ? (
                <Text style={styles.meta}>
                  Odo {item.startOdometer.toFixed(1)} → {item.endOdometer.toFixed(1)}
                  {item.photos && item.photos.length >= 2 ? " · photos attached" : ""}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  empty: { fontFamily: fonts.regular, color: colors.mutedForeground, textAlign: "center", marginTop: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  amount: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 18 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11, textTransform: "capitalize" },
  route: { fontFamily: fonts.medium, color: colors.foreground, fontSize: 15 },
  meta: { fontFamily: fonts.regular, color: colors.mutedForeground, fontSize: 12, marginTop: 4 },
});
