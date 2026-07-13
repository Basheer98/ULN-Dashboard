import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { getToken } from "../src/lib/auth";
import { loadStateRates, type StateRate } from "../src/lib/admin-api";
import { apiRequest } from "../src/lib/api";
import { colors } from "../src/lib/theme";
import { fonts } from "../src/lib/fonts";

export default function RatesScreen() {
  const [rates, setRates] = useState<StateRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [state, setState] = useState("");
  const [clientRate, setClientRate] = useState("0.03");
  const [fielderRate, setFielderRate] = useState("0.015");

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setRates(await loadStateRates(token));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

  async function addRate() {
    if (!state.trim()) {
      Alert.alert("State required", "Enter a 2-letter state code.");
      return;
    }
    const token = await getToken();
    if (!token) return;
    try {
      await apiRequest("/state-rates", {
        method: "POST",
        token,
        body: JSON.stringify({
          state: state.trim().toUpperCase(),
          clientSqftRate: parseFloat(clientRate) || 0,
          fielderSqftRate: parseFloat(fielderRate) || 0,
        }),
      });
      setState("");
      load();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to add rate");
    }
  }

  async function removeRate(stateCode: string) {
    const token = await getToken();
    if (!token) return;
    try {
      await apiRequest(`/state-rates/${stateCode}`, { method: "DELETE", token });
      load();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete rate");
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
      data={rates}
      keyExtractor={(item) => item.state}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={() => { setRefreshing(true); load(); }} />
      }
      ListHeaderComponent={
        <View>
          <Text style={styles.heading}>State rates</Text>
          <Text style={styles.subheading}>SQFT rate overrides by state</Text>
          <View style={styles.form}>
            <TextInput style={styles.input} value={state} onChangeText={setState} placeholder="State (TX)" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" maxLength={2} />
            <TextInput style={styles.input} value={clientRate} onChangeText={setClientRate} placeholder="Client rate" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
            <TextInput style={styles.input} value={fielderRate} onChangeText={setFielderRate} placeholder="Fielder rate" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />
            <TouchableOpacity style={styles.addBtn} onPress={addRate}>
              <Text style={styles.addBtnText}>Add override</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.state}>{item.state}</Text>
            <TouchableOpacity onPress={() => removeRate(item.state)}>
              <Text style={styles.delete}>Remove</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.meta}>Client: ${item.clientSqftRate}/SQFT · Fielder: ${item.fielderSqftRate}/SQFT</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  heading: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 24 },
  subheading: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14, marginTop: 4, marginBottom: 16 },
  form: { gap: 8, marginBottom: 16 },
  input: {
    fontFamily: fonts.regular,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.foreground,
    fontSize: 15,
  },
  addBtn: { backgroundColor: colors.accent, borderRadius: 10, padding: 12, alignItems: "center" },
  addBtnText: { fontFamily: fonts.semibold, color: colors.accentForeground },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  state: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 16 },
  delete: { fontFamily: fonts.medium, color: colors.danger, fontSize: 13 },
  meta: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13, marginTop: 6 },
});
