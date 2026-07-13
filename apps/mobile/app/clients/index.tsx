import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getToken } from "../../src/lib/auth";
import { loadClients, type Client } from "../../src/lib/admin-api";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";

export default function ClientsScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return router.replace("/login");
    try {
      setClients(await loadClients(token));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

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
        data={clients}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.heading}>Clients</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/clients/new")}>
              <Ionicons name="add" size={22} color={colors.accentForeground} />
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/clients/${item.id}`)}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.contactName || "No contact"} · ${item.defaultSqftRate}/SQFT</Text>
            <Text style={[styles.meta, !item.isActive && styles.inactive]}>
              {item.isActive ? "Active" : "Inactive"}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, paddingBottom: 40 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  heading: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 24 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 10 },
  name: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 16 },
  meta: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13, marginTop: 4 },
  inactive: { color: colors.danger },
});
