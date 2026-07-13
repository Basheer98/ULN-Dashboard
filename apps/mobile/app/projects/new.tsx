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
import { router } from "expo-router";
import { apiRequest } from "../../src/lib/api";
import { getToken } from "../../src/lib/auth";
import { loadClients, loadFielders, resolveRates, type Client, type Fielder } from "../../src/lib/admin-api";
import { FormField, FormSection } from "../../src/components/form-field";
import { ChipPicker, OptionList } from "../../src/components/chip-picker";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";

export default function NewProjectScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [fielders, setFielders] = useState<Fielder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [projectNumber, setProjectNumber] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [jobType, setJobType] = useState("");
  const [qfield, setQfield] = useState<"1" | "2" | null>(null);
  const [sqft, setSqft] = useState("");
  const [clientSqftRate, setClientSqftRate] = useState("0.03");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [assignFielder, setAssignFielder] = useState(false);
  const [fielderId, setFielderId] = useState<string | null>(null);
  const [fielderSqftRate, setFielderSqftRate] = useState("0.015");

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return router.replace("/login");
      try {
        const [c, f] = await Promise.all([loadClients(token), loadFielders(token)]);
        setClients(c.filter((x) => x.isActive));
        setFielders(f.filter((x) => x.isActive));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const rates = await resolveRates(token, {
          clientId,
          state: state || undefined,
          fielderId: fielderId || undefined,
        });
        setClientSqftRate(String(rates.clientSqftRate));
        if (fielderId) setFielderSqftRate(String(rates.fielderSqftRate));
      } catch {
        /* keep defaults */
      }
    })();
  }, [clientId, state, fielderId]);

  async function handleSubmit() {
    if (!projectNumber.trim() || !clientId || !title.trim() || !siteAddress.trim()) {
      Alert.alert("Missing fields", "Project number, client, title, and address are required.");
      return;
    }
    const parsedSqft = parseFloat(sqft);
    if (!parsedSqft || parsedSqft <= 0) {
      Alert.alert("Invalid SQFT", "Enter a valid square footage.");
      return;
    }

    setSubmitting(true);
    const token = await getToken();
    if (!token) return router.replace("/login");

    try {
      const body: Record<string, unknown> = {
        projectNumber: projectNumber.trim(),
        clientId,
        title: title.trim(),
        siteAddress: siteAddress.trim(),
        city: city || undefined,
        state: state || undefined,
        zip: zip || undefined,
        jobType: jobType || undefined,
        qfield: qfield ? Number(qfield) : undefined,
        sqft: parsedSqft,
        clientSqftRate: parseFloat(clientSqftRate) || 0,
        dueDate: dueDate || undefined,
        description: description || undefined,
        notes: notes || undefined,
      };
      if (assignFielder && fielderId) {
        body.assignment = {
          fielderId,
          fielderSqftRate: parseFloat(fielderSqftRate) || 0,
        };
      }
      const project = await apiRequest<{ id: string }>("/projects", {
        method: "POST",
        token,
        body: JSON.stringify(body),
      });
      router.replace(`/projects/${project.id}`);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create project");
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
      <FormSection title="Project info">
        <FormField label="Project number *" value={projectNumber} onChangeText={setProjectNumber} placeholder="ULN-2026-001" />
        <OptionList label="Client *" items={clients} selectedId={clientId} onSelect={setClientId} getLabel={(c) => c.name} />
        <FormField label="Title *" value={title} onChangeText={setTitle} placeholder="Site survey" />
        <FormField label="Site address *" value={siteAddress} onChangeText={setSiteAddress} placeholder="123 Main St" />
        <FormField label="City" value={city} onChangeText={setCity} />
        <FormField label="State" value={state} onChangeText={setState} placeholder="TX" />
        <FormField label="ZIP" value={zip} onChangeText={setZip} keyboardType="numeric" />
        <FormField label="Job type" value={jobType} onChangeText={setJobType} placeholder="Fiber drop" />
        <ChipPicker label="QField" options={["1", "2"] as const} value={qfield} onChange={setQfield} formatLabel={(v) => `QField ${v}`} />
        <FormField label="SQFT *" value={sqft} onChangeText={setSqft} keyboardType="decimal-pad" placeholder="5000" />
        <FormField label="Client rate ($/SQFT)" value={clientSqftRate} onChangeText={setClientSqftRate} keyboardType="decimal-pad" />
        <FormField label="ECD (YYYY-MM-DD)" value={dueDate} onChangeText={setDueDate} placeholder="2026-07-20" />
        <FormField label="Description" value={description} onChangeText={setDescription} multiline />
        <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />
      </FormSection>

      <FormSection title="Assignment (optional)">
        <ChipPicker
          label="Assign fielder now?"
          options={["no", "yes"] as const}
          value={assignFielder ? "yes" : "no"}
          onChange={(v) => setAssignFielder(v === "yes")}
        />
        {assignFielder ? (
          <>
            <OptionList
              label="Fielder"
              items={fielders}
              selectedId={fielderId}
              onSelect={setFielderId}
              getLabel={(f) => `${f.firstName} ${f.lastName}`}
            />
            <FormField label="Fielder rate ($/SQFT)" value={fielderSqftRate} onChangeText={setFielderSqftRate} keyboardType="decimal-pad" />
          </>
        ) : null}
      </FormSection>

      <TouchableOpacity style={styles.submit} onPress={handleSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={colors.accentForeground} />
        ) : (
          <Text style={styles.submitText}>Create project</Text>
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
