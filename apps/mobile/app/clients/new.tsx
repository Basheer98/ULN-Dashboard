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
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";

export default function NewClientScreen() {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultSqftRate, setDefaultSqftRate] = useState("0.03");
  const [billingTerms, setBillingTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) {
      Alert.alert("Name required", "Client name is required.");
      return;
    }
    setSubmitting(true);
    const token = await getToken();
    if (!token) return router.replace("/login");
    try {
      const client = await apiRequest<{ id: string }>("/clients", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: name.trim(),
          contactName: contactName || undefined,
          email: email || undefined,
          phone: phone || undefined,
          defaultSqftRate: parseFloat(defaultSqftRate) || 0,
          billingTerms: billingTerms || undefined,
          notes: notes || undefined,
        }),
      });
      router.replace(`/clients/${client.id}`);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setSubmitting(false);
    }
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
      <TouchableOpacity style={styles.submit} onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color={colors.accentForeground} /> : <Text style={styles.submitText}>Create client</Text>}
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
