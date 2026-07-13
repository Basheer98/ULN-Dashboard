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
import { loadClients, resolveRates, type Client } from "../../../src/lib/admin-api";
import { FormField, FormSection } from "../../../src/components/form-field";
import { ChipPicker, OptionList } from "../../../src/components/chip-picker";
import { PROJECT_STATUSES } from "../../../src/lib/permissions";
import { colors } from "../../../src/lib/theme";
import { fonts } from "../../../src/lib/fonts";

interface ProjectEdit {
  id: string;
  projectNumber: string;
  clientId: string;
  title: string;
  siteAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  jobType: string | null;
  qfield: number | null;
  sqft: number;
  clientSqftRate: number;
  status: string;
  dueDate: string | null;
  description: string | null;
  notes: string | null;
}

export default function EditProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [clients, setClients] = useState<Client[]>([]);
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
  const [clientSqftRate, setClientSqftRate] = useState("");
  const [status, setStatus] = useState<string>("draft");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token || !id) return router.replace("/login");
      try {
        const [project, clientList] = await Promise.all([
          apiRequest<ProjectEdit>(`/projects/${id}`, { token }),
          loadClients(token),
        ]);
        setClients(clientList.filter((c) => c.isActive));
        setProjectNumber(project.projectNumber);
        setClientId(project.clientId);
        setTitle(project.title);
        setSiteAddress(project.siteAddress);
        setCity(project.city ?? "");
        setState(project.state ?? "");
        setZip(project.zip ?? "");
        setJobType(project.jobType ?? "");
        setQfield(project.qfield === 1 || project.qfield === 2 ? String(project.qfield) as "1" | "2" : null);
        setSqft(String(project.sqft));
        setClientSqftRate(String(project.clientSqftRate));
        setStatus(project.status);
        setDueDate(project.dueDate ? project.dueDate.slice(0, 10) : "");
        setDescription(project.description ?? "");
        setNotes(project.notes ?? "");
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Unable to load project");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const rates = await resolveRates(token, { clientId, state: state || undefined });
        setClientSqftRate(String(rates.clientSqftRate));
      } catch {
        /* keep current */
      }
    })();
  }, [clientId, state]);

  async function handleSubmit() {
    if (!clientId || !title.trim() || !siteAddress.trim()) {
      Alert.alert("Missing fields", "Client, title, and address are required.");
      return;
    }
    const parsedSqft = parseFloat(sqft);
    if (!parsedSqft || parsedSqft <= 0) {
      Alert.alert("Invalid SQFT", "Enter a valid square footage.");
      return;
    }

    setSubmitting(true);
    const token = await getToken();
    if (!token || !id) return;

    try {
      await apiRequest(`/projects/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          clientId,
          title: title.trim(),
          siteAddress: siteAddress.trim(),
          city: city || undefined,
          state: state || undefined,
          zip: zip || undefined,
          jobType: jobType || undefined,
          qfield: qfield ? Number(qfield) : null,
          sqft: parsedSqft,
          clientSqftRate: parseFloat(clientSqftRate) || 0,
          status,
          dueDate: dueDate || null,
          description: description || undefined,
          notes: notes || undefined,
        }),
      });
      router.back();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update project");
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
      <FormField label="Project number" value={projectNumber} onChangeText={setProjectNumber} editable={false} />
      <OptionList label="Client *" items={clients} selectedId={clientId} onSelect={setClientId} getLabel={(c) => c.name} />
      <FormField label="Title *" value={title} onChangeText={setTitle} />
      <FormField label="Site address *" value={siteAddress} onChangeText={setSiteAddress} />
      <FormField label="City" value={city} onChangeText={setCity} />
      <FormField label="State" value={state} onChangeText={setState} />
      <FormField label="ZIP" value={zip} onChangeText={setZip} />
      <FormField label="Job type" value={jobType} onChangeText={setJobType} />
      <ChipPicker label="QField" options={["1", "2"] as const} value={qfield} onChange={setQfield} formatLabel={(v) => `QField ${v}`} />
      <FormField label="SQFT *" value={sqft} onChangeText={setSqft} keyboardType="decimal-pad" />
      <FormField label="Client rate ($/SQFT)" value={clientSqftRate} onChangeText={setClientSqftRate} keyboardType="decimal-pad" />
      <ChipPicker
        label="Status"
        options={PROJECT_STATUSES}
        value={status as (typeof PROJECT_STATUSES)[number]}
        onChange={setStatus}
      />
      <FormField label="ECD (YYYY-MM-DD)" value={dueDate} onChangeText={setDueDate} />
      <FormField label="Description" value={description} onChangeText={setDescription} multiline />
      <FormField label="Notes" value={notes} onChangeText={setNotes} multiline />

      <TouchableOpacity style={styles.submit} onPress={handleSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={colors.accentForeground} />
        ) : (
          <Text style={styles.submitText}>Save changes</Text>
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
