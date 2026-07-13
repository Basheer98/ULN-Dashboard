import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { apiRequest, API_URL } from "../../src/lib/api";
import { getToken } from "../../src/lib/auth";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";
import { getEcdLabel } from "../../src/lib/dates";
import { openDirections } from "../../src/lib/maps";

interface AssignmentDetail {
  id: string;
  status: string;
  fielderSqftRate: number;
  assignedSqft?: number;
  notes: string | null;
  project: {
    id: string;
    projectNumber: string;
    title: string;
    siteAddress: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    sqft: number;
    jobType: string | null;
    qfield: number | null;
    dueDate?: string | null;
    description: string | null;
    notes: string | null;
    client: { name: string };
  };
}

interface Attachment {
  id: string;
  fileName: string;
  fileKey: string;
  url?: string;
}

const STATUS_ACTIONS = [
  { label: "Accept Job", status: "accepted" },
  { label: "Start Job", status: "in_progress" },
  { label: "Mark Complete", status: "complete" },
];

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token || !id) return;

    try {
      const jobs = await apiRequest<AssignmentDetail[]>("/assignments/mine", { token });
      const found = jobs.find((j) => j.id === id);
      setAssignment(found ?? null);

      if (found) {
        const attachments = await apiRequest<Attachment[]>(
          `/projects/${found.project.id}/attachments`,
          { token }
        );
        setPhotos(attachments);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function updateStatus(status: string) {
    const token = await getToken();
    if (!token || !id) return;

    setUpdating(true);
    try {
      const updated = await apiRequest<AssignmentDetail>(`/assignments/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      setAssignment(updated);
      Alert.alert("Updated", `Job status: ${status.replace(/_/g, " ")}`);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  }

  async function uploadPhoto() {
    const token = await getToken();
    if (!token || !assignment) return;

    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera access is required for completion photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: `photo-${Date.now()}.jpg`,
        type: "image/jpeg",
      } as unknown as Blob);

      const res = await fetch(`${API_URL}/projects/${assignment.project.id}/attachments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPhotos((prev) => [...prev, data]);
      Alert.alert("Uploaded", "Completion photo saved.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!assignment) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Job not found.</Text>
      </View>
    );
  }

  const p = assignment.project;
  const sqft = assignment.assignedSqft ?? p.sqft;
  const payEstimate = Number(sqft) * Number(assignment.fielderSqftRate);
  const ecd = getEcdLabel(p.dueDate);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.number}>{p.projectNumber}</Text>
      <Text style={styles.title}>{p.title}</Text>
      <Text style={styles.status}>Status: {assignment.status.replace(/_/g, " ")}</Text>
      {ecd && (
        <View
          style={[
            styles.ecdBanner,
            ecd.overdue && styles.ecdOverdue,
            ecd.urgent && !ecd.overdue && styles.ecdUrgent,
          ]}
        >
          <Text style={styles.ecdText}>ECD: {ecd.text}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Client</Text>
        <Text style={styles.text}>{p.client.name}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Text style={styles.text}>{p.siteAddress}</Text>
        <Text style={styles.textMuted}>
          {[p.city, p.state, p.zip].filter(Boolean).join(", ")}
        </Text>
        <TouchableOpacity
          style={styles.directionsBtn}
          onPress={() => openDirections(p.siteAddress, p.city, p.state, p.zip)}
        >
          <Text style={styles.directionsText}>Open in Maps</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Job Info</Text>
        <Text style={styles.text}>SQFT: {Number(sqft).toLocaleString()}</Text>
        <Text style={styles.text}>Rate: ${assignment.fielderSqftRate}/SQFT</Text>
        <Text style={styles.text}>Est. Pay: ${payEstimate.toLocaleString()}</Text>
        {p.qfield && (
          <Text style={styles.qfield}>Log in to QField {p.qfield} to open this project file</Text>
        )}
        {p.jobType && <Text style={styles.text}>Type: {p.jobType}</Text>}
        {p.description && <Text style={styles.textMuted}>{p.description}</Text>}
        {p.notes && <Text style={styles.textMuted}>Notes: {p.notes}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Completion Photos</Text>
        {photos.length === 0 ? (
          <Text style={styles.textMuted}>No photos uploaded yet.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {photos.map((photo) => (
              <Image
                key={photo.id}
                source={{ uri: photo.url ?? `${API_URL.replace("/api/v1", "")}/api/v1/files/${photo.fileKey}` }}
                style={styles.thumbnail}
              />
            ))}
          </ScrollView>
        )}
        <TouchableOpacity
          style={[styles.buttonOutline, uploading && styles.buttonDisabled]}
          disabled={uploading}
          onPress={uploadPhoto}
        >
          <Text style={styles.buttonOutlineText}>
            {uploading ? "Uploading..." : "Take Completion Photo"}
          </Text>
        </TouchableOpacity>
      </View>

      {assignment.status !== "complete" && (
        <View style={styles.actions}>
          {STATUS_ACTIONS.filter((a) => {
            if (assignment.status === "assigned" && a.status === "accepted") return true;
            if (
              (assignment.status === "assigned" || assignment.status === "accepted") &&
              a.status === "in_progress"
            )
              return true;
            if (assignment.status === "in_progress" && a.status === "complete") return true;
            return false;
          }).map((action) => (
            <TouchableOpacity
              key={action.status}
              style={styles.button}
              disabled={updating}
              onPress={() => updateStatus(action.status)}
            >
              <Text style={styles.buttonText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: { fontFamily: fonts.regular, color: colors.mutedForeground, fontSize: 16 },
  number: { fontFamily: fonts.semibold, color: colors.accent, fontSize: 14 },
  title: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 22, marginTop: 4 },
  status: {
    color: colors.warning,
    marginTop: 8,
    marginBottom: 8,
    textTransform: "capitalize",
  },
  ecdBanner: {
    backgroundColor: colors.info + "22",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  ecdUrgent: { backgroundColor: colors.warning + "22" },
  ecdOverdue: { backgroundColor: colors.danger + "22" },
  ecdText: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 14 },
  directionsBtn: {
    marginTop: 10,
    backgroundColor: colors.accent + "22",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  directionsText: { fontFamily: fonts.semibold, color: colors.accent, fontSize: 14 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    color: colors.mutedForeground,
    fontSize: 11,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  text: { fontFamily: fonts.regular, color: colors.foreground, fontSize: 15, marginBottom: 4 },
  qfield: {
    fontFamily: fonts.semibold,
    color: colors.accent,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 2,
  },
  textMuted: { color: colors.mutedForeground, fontSize: 14, marginTop: 4 },
  actions: { marginTop: 8, gap: 10 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  buttonOutlineText: { fontFamily: fonts.semibold, color: colors.accent, fontSize: 15 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontFamily: fonts.semibold, color: colors.accentForeground, fontSize: 16 },
  thumbnail: { width: 80, height: 80, borderRadius: 8, marginRight: 8 },
});
