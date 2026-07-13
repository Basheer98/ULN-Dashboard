import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { apiRequest } from "../../../src/lib/api";
import { getToken } from "../../../src/lib/auth";
import { loadFielders, resolveRates, type Fielder } from "../../../src/lib/admin-api";
import { FormField } from "../../../src/components/form-field";
import { OptionList } from "../../../src/components/chip-picker";
import { colors } from "../../../src/lib/theme";
import { fonts } from "../../../src/lib/fonts";

export default function AssignFielderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [fielders, setFielders] = useState<Fielder[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [state, setState] = useState("");
  const [fielderId, setFielderId] = useState<string | null>(null);
  const [fielderSqftRate, setFielderSqftRate] = useState("0.015");
  const [assignedSqft, setAssignedSqft] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token || !id) return router.replace("/login");
      try {
        const [project, fielderList] = await Promise.all([
          apiRequest<{ clientId: string; state: string | null; sqft: number }>(`/projects/${id}`, { token }),
          loadFielders(token),
        ]);
        setClientId(project.clientId);
        setState(project.state ?? "");
        setAssignedSqft(String(project.sqft));
        setFielders(fielderList.filter((f) => f.isActive));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!fielderId || !clientId) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const rates = await resolveRates(token, { clientId, state: state || undefined, fielderId });
        setFielderSqftRate(String(rates.fielderSqftRate));
      } catch {
        /* keep default */
      }
    })();
  }, [fielderId, clientId, state]);

  async function handleSubmit() {
    if (!fielderId) {
      Alert.alert("Select fielder", "Choose a fielder to assign.");
      return;
    }
    setSubmitting(true);
    const token = await getToken();
    if (!token || !id) return;

    try {
      await apiRequest(`/projects/${id}/assignments`, {
        method: "POST",
        token,
        body: JSON.stringify({
          fielderId,
          fielderSqftRate: parseFloat(fielderSqftRate) || 0,
          assignedSqft: assignedSqft ? parseFloat(assignedSqft) : undefined,
          notes: notes || undefined,
        }),
      });
      router.back();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to assign fielder");
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
      <OptionList
        label="Fielder *"
        items={fielders}
        selectedId={fielderId}
        onSelect={setFielderId}
        getLabel={(f) => `${f.firstName} ${f.lastName}`}
      />
      <FormField label="Fielder rate ($/SQFT)" value={fielderSqftRate} onChangeText={setFielderSqftRate} keyboardType="decimal-pad" />
      <FormField label="Assigned SQFT" value={assignedSqft} onChangeText={setAssignedSqft} keyboardType="decimal-pad" />
      <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />

      <TouchableOpacity style={styles.submit} onPress={handleSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={colors.accentForeground} />
        ) : (
          <Text style={styles.submitText}>Assign fielder</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
  },
  submitText: { fontFamily: fonts.semibold, color: colors.accentForeground, fontSize: 16 },
});
