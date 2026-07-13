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
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultSqftRate, setDefaultSqftRate] = useState("");
  const [billingTerms, setBillingTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token || !id) return;
      try {
        const client = await apiRequest<{
          name: string; contactName: string | null; email: string | null;
          phone: string | null; defaultSqftRate: number; billingTerms: string | null;
          notes: string | null; isActive: boolean;
        }>(`/clients/${id}`, { token });
        setName(client.name);
        setContactName(client.contactName ?? "");
        setEmail(client.email ?? "");
        setPhone(client.phone ?? "");
        setDefaultSqftRate(String(client.defaultSqftRate));
        setBillingTerms(client.billingTerms ?? "");
        setNotes(client.notes ?? "");
        setIsActive(client.isActive);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Name required", "Client name is required.");
      return;
    }
    setSubmitting(true);
    const token = await getToken();
    if (!token || !id) return;
    try {
      await apiRequest(`/clients/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          name: name.trim(),
          contactName: contactName || undefined,
          email: email || undefined,
          phone: phone || undefined,
          defaultSqftRate: parseFloat(defaultSqftRate) || 0,
          billingTerms: billingTerms || undefined,
          notes: notes || undefined,
          isActive,
        }),
      });
      Alert.alert("Saved", "Client updated.");
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
      <FormField label="Name *" value={name} onChangeText={setName} />
      <FormField label="Contact name" value={contactName} onChangeText={setContactName} />
      <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <FormField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <FormField label="Default rate ($/SQFT)" value={defaultSqftRate} onChangeText={setDefaultSqftRate} keyboardType="decimal-pad" />
      <FormField label="Billing terms" value={billingTerms} onChangeText={setBillingTerms} />
      <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Active</Text>
        <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: colors.accent }} />
      </View>
      <TouchableOpacity style={styles.submit} onPress={handleSave} disabled={submitting}>
        {submitting ? <ActivityIndicator color={colors.accentForeground} /> : <Text style={styles.submitText}>Save client</Text>}
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
