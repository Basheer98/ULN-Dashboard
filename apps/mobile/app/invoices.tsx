import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getToken } from "../src/lib/auth";
import { loadInvoices, type Invoice } from "../src/lib/admin-api";
import { apiRequest } from "../src/lib/api";
import { colors, getStatusColor } from "../src/lib/theme";
import { fonts } from "../src/lib/fonts";

const INVOICE_STATUSES = ["draft", "sent", "partial", "paid", "overdue"] as const;

export default function InvoicesScreen() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return router.replace("/login");
    try {
      setInvoices(await loadInvoices(token));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

  async function updateStatus(invoice: Invoice, status: string) {
    const token = await getToken();
    if (!token) return;
    try {
      await apiRequest(`/invoices/${invoice.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      load();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update invoice");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={invoices}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={() => { setRefreshing(true); load(); }} />
      }
      ListHeaderComponent={
        <View>
          <Text style={styles.heading}>Invoices</Text>
          <Text style={styles.subheading}>{invoices.length} invoice{invoices.length === 1 ? "" : "s"}</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No invoices yet.</Text>}
      renderItem={({ item }) => {
        const statusColor = getStatusColor(item.status);
        return (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/projects/${item.project.id}`)}>
            <View style={styles.top}>
              <Text style={styles.number}>{item.invoiceNumber}</Text>
              <View style={[styles.badge, { backgroundColor: `${statusColor}22` }]}>
                <Text style={[styles.badgeText, { color: statusColor }]}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.title}>{item.project.projectNumber} · {item.project.title}</Text>
            <Text style={styles.meta}>{item.client.name} · ${Number(item.totalAmount).toFixed(2)}</Text>
            <View style={styles.chipRow}>
              {INVOICE_STATUSES.filter((s) => s !== item.status).map((status) => (
                <TouchableOpacity key={status} style={styles.chip} onPress={() => updateStatus(item, status)}>
                  <Text style={styles.chipText}>{status}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  heading: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 24 },
  subheading: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14, marginTop: 4, marginBottom: 16 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 10 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  number: { fontFamily: fonts.semibold, color: colors.accent, fontSize: 13 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 10, textTransform: "capitalize" },
  title: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 15, marginTop: 8 },
  meta: { fontFamily: fonts.regular, color: colors.muted, fontSize: 12, marginTop: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontFamily: fonts.medium, color: colors.mutedForeground, fontSize: 10, textTransform: "capitalize" },
  empty: { fontFamily: fonts.regular, color: colors.mutedForeground, textAlign: "center", marginTop: 40 },
});
