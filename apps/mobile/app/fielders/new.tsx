import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { apiRequest } from "../../src/lib/api";
import { getToken } from "../../src/lib/auth";
import { FormField } from "../../src/components/form-field";
import { ChipPicker } from "../../src/components/chip-picker";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";

export default function NewFielderScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [employmentType, setEmploymentType] = useState<"contractor_1099" | "w2">("contractor_1099");
  const [defaultSqftRate, setDefaultSqftRate] = useState("0.015");
  const [region, setRegion] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Name required", "First and last name are required.");
      return;
    }
    setSubmitting(true);
    const token = await getToken();
    if (!token) return router.replace("/login");
    try {
      const fielder = await apiRequest<{ id: string }>("/fielders", {
        method: "POST",
        token,
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone || undefined,
          email: email || undefined,
          employmentType,
          defaultSqftRate: parseFloat(defaultSqftRate) || 0,
          region: region || undefined,
          loginEmail: loginEmail || undefined,
          loginPassword: loginPassword || undefined,
        }),
      });
      router.replace(`/fielders/${fielder.id}`);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create fielder");
    } finally {
      setSubmitting(false);
    }
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
      <FormField label="Login email (optional)" value={loginEmail} onChangeText={setLoginEmail} keyboardType="email-address" />
      <FormField label="Login password (optional)" value={loginPassword} onChangeText={setLoginPassword} />
      <TouchableOpacity style={styles.submit} onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color={colors.accentForeground} /> : <Text style={styles.submitText}>Create fielder</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  submit: { backgroundColor: colors.accent, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 20 },
  submitText: { fontFamily: fonts.semibold, color: colors.accentForeground, fontSize: 16 },
});
