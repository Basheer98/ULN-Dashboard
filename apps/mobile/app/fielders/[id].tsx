import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { apiRequest } from "../../src/lib/api";
import { getToken } from "../../src/lib/auth";
import { FormField } from "../../src/components/form-field";
import { ChipPicker } from "../../src/components/chip-picker";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";

export default function FielderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [employmentType, setEmploymentType] = useState<"contractor_1099" | "w2">("contractor_1099");
  const [defaultSqftRate, setDefaultSqftRate] = useState("");
  const [region, setRegion] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token || !id) return;
      try {
        const f = await apiRequest<{
          firstName: string; lastName: string; phone: string | null; email: string | null;
          employmentType: string; defaultSqftRate: number; region: string | null; isActive: boolean;
        }>(`/fielders/${id}`, { token });
        setFirstName(f.firstName);
        setLastName(f.lastName);
        setPhone(f.phone ?? "");
        setEmail(f.email ?? "");
        setEmploymentType(f.employmentType as "contractor_1099" | "w2");
        setDefaultSqftRate(String(f.defaultSqftRate));
        setRegion(f.region ?? "");
        setIsActive(f.isActive);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Name required", "First and last name are required.");
      return;
    }
    setSubmitting(true);
    const token = await getToken();
    if (!token || !id) return;
    try {
      await apiRequest(`/fielders/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone || undefined,
          email: email || undefined,
          employmentType,
          defaultSqftRate: parseFloat(defaultSqftRate) || 0,
          region: region || undefined,
          isActive,
        }),
      });
      Alert.alert("Saved", "Fielder updated.");
      router.back();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <FormField label="First name *" value={firstName} onChangeText={setFirstName} />
      <FormField label="Last name *" value={lastName} onChangeText={setLastName} />
      <FormField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <ChipPicker
        label="Employment type"
        options={["contractor_1099", "w2"] as const}
        value={employmentType}
        onChange={setEmploymentType}
        formatLabel={(v) => (v === "w2" ? "W-2" : "1099 Contractor")}
      />
      <FormField label="Default rate ($/SQFT)" value={defaultSqftRate} onChangeText={setDefaultSqftRate} keyboardType="decimal-pad" />
      <FormField label="Region" value={region} onChangeText={setRegion} />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Active</Text>
        <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.accent }} />
      </View>
      <TouchableOpacity style={styles.submit} onPress={handleSave} disabled={submitting}>
        {submitting ? <ActivityIndicator color={colors.accentForeground} /> : <Text style={styles.submitText}>Save fielder</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 12 },
  switchLabel: { fontFamily: fonts.medium, color: colors.foreground, fontSize: 15 },
  submit: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 12 },
  submitText: { fontFamily: fonts.semibold, color: colors.accentForeground, fontSize: 16 },
});
