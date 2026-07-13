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
import { loadOfficeUsers, type OfficeUser } from "../src/lib/admin-api";
import { apiRequest } from "../src/lib/api";
import { ChipPicker } from "../src/components/chip-picker";
import { colors } from "../src/lib/theme";
import { fonts } from "../src/lib/fonts";

export default function TeamScreen() {
  const [users, setUsers] = useState<OfficeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "dispatcher" | "accountant">("dispatcher");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setUsers(await loadOfficeUsers(token));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

  async function addUser() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Required", "Email and password are required.");
      return;
    }
    const token = await getToken();
    if (!token) return;
    try {
      await apiRequest("/users", {
        method: "POST",
        token,
        body: JSON.stringify({
          email: email.trim(),
          password,
          role,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        }),
      });
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      load();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create user");
    }
  }

  async function toggleActive(user: OfficeUser) {
    const token = await getToken();
    if (!token) return;
    try {
      await apiRequest(`/users/${user.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      load();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update user");
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
      data={users}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={() => { setRefreshing(true); load(); }} />
      }
      ListHeaderComponent={
        <View>
          <Text style={styles.heading}>Team</Text>
          <Text style={styles.subheading}>Office user accounts</Text>
          <View style={styles.form}>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.mutedForeground} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.mutedForeground} secureTextEntry />
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={colors.mutedForeground} />
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={colors.mutedForeground} />
            <ChipPicker label="Role" options={["admin", "dispatcher", "accountant"] as const} value={role} onChange={setRole} />
            <TouchableOpacity style={styles.addBtn} onPress={addUser}>
              <Text style={styles.addBtnText}>Add user</Text>
            </TouchableOpacity>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.name}>
            {item.firstName || item.lastName ? `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim() : item.email}
          </Text>
          <Text style={styles.meta}>{item.email} · {item.role}</Text>
          <TouchableOpacity onPress={() => toggleActive(item)}>
            <Text style={[styles.toggle, !item.isActive && styles.inactive]}>
              {item.isActive ? "Deactivate" : "Activate"}
            </Text>
          </TouchableOpacity>
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
  name: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 16 },
  meta: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13, marginTop: 4 },
  toggle: { fontFamily: fonts.medium, color: colors.accent, fontSize: 13, marginTop: 8 },
  inactive: { color: colors.success },
});
