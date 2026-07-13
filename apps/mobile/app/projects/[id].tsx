import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useFocusEffect, router } from "expo-router";
import { apiRequest } from "../../src/lib/api";
import { getToken, getUser } from "../../src/lib/auth";
import { hasPermission, ASSIGNMENT_STATUSES, PROJECT_STATUSES } from "../../src/lib/permissions";
import { colors, getStatusColor } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";
import { layout, screenStyles } from "../../src/lib/layout";
import { getEcdLabel } from "../../src/lib/dates";
import { openDirections } from "../../src/lib/maps";
import { StatusBadge } from "../../src/components/status-badge";

interface ProjectDetail {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
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
  assignments: Array<{
    id: string;
    status: string;
    fielderSqftRate: number;
    fielder: { firstName: string; lastName: string };
  }>;
  financials?: {
    client: { total: number };
    totalFielderPay: number;
    margin: number;
  };
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [canInvoice, setCanInvoice] = useState(false);
  const [canPay, setCanPay] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token || !id) return;
    const user = await getUser();
    setCanWrite(hasPermission(user?.role, "projects:write"));
    setCanInvoice(hasPermission(user?.role, "invoices:write"));
    setCanPay(hasPermission(user?.role, "payments:write"));
    try {
      setError("");
      const data = await apiRequest<ProjectDetail>(`/projects/${id}`, { token });
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load project");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => void load(), [load]));

  async function updateStatus(status: string) {
    const token = await getToken();
    if (!token || !id) return;
    setActing(true);
    try {
      await apiRequest(`/projects/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setActing(false);
    }
  }

  async function updateAssignment(assignmentId: string, status: string) {
    const token = await getToken();
    if (!token) return;
    setActing(true);
    try {
      await apiRequest(`/assignments/${assignmentId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update assignment");
    } finally {
      setActing(false);
    }
  }

  async function generateInvoice() {
    const token = await getToken();
    if (!token || !id) return;
    setActing(true);
    try {
      await apiRequest("/invoices", { method: "POST", token, body: JSON.stringify({ projectId: id }) });
      Alert.alert("Invoice created", "Invoice generated for this project.");
      await load();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to generate invoice");
    } finally {
      setActing(false);
    }
  }

  async function generatePayment() {
    const token = await getToken();
    if (!token || !id) return;
    setActing(true);
    try {
      await apiRequest("/payments", { method: "POST", token, body: JSON.stringify({ projectId: id }) });
      Alert.alert("Payment created", "Fielder payment generated for this project.");
      await load();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to generate payment");
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <View style={screenStyles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!project) {
    return (
      <View style={screenStyles.center}>
        <Text style={styles.error}>{error || "Project not found"}</Text>
      </View>
    );
  }

  const statusColor = getStatusColor(project.status);
  const ecd = getEcdLabel(project.dueDate);
  const nextStatuses = PROJECT_STATUSES.filter((s) => s !== project.status);

  return (
    <ScrollView style={screenStyles.container} contentContainerStyle={screenStyles.content}>
      <View style={screenStyles.rowBetween}>
        <Text style={styles.projectNumber} numberOfLines={1}>
          {project.projectNumber}
        </Text>
        <StatusBadge label={project.status} color={statusColor} />
      </View>
      <Text style={styles.title}>{project.title}</Text>
      <Text style={styles.meta}>{project.client.name}</Text>

      <TouchableOpacity
        onPress={() =>
          openDirections(project.siteAddress, project.city, project.state, project.zip)
        }
      >
        <Text style={styles.link}>
          {project.siteAddress}
          {project.city ? `, ${project.city}` : ""}
          {project.state ? ` ${project.state}` : ""}
        </Text>
      </TouchableOpacity>

      {ecd ? <Text style={styles.meta}>ECD: {ecd.text}</Text> : null}
      <Text style={styles.meta}>SQFT: {Number(project.sqft).toLocaleString()}</Text>
      <Text style={styles.meta}>Job type: {project.jobType || "—"}</Text>
      <Text style={styles.meta}>QField: {project.qfield ? `QField ${project.qfield}` : "—"}</Text>

      {canWrite ? (
        <View style={[screenStyles.rowWrap, { marginTop: 14 }]}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/projects/${id}/edit`)}>
            <Text style={styles.actionText}>Edit project</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/projects/${id}/assign`)}>
            <Text style={styles.actionText}>Assign fielder</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {canWrite && nextStatuses.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Change status</Text>
          <View style={screenStyles.rowWrap}>
            {nextStatuses.map((status) => (
              <TouchableOpacity
                key={status}
                style={styles.chip}
                disabled={acting}
                onPress={() => updateStatus(status)}
              >
                <Text style={styles.chipText}>{status.replace(/_/g, " ")}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {project.financials ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Financials</Text>
          <Text style={styles.meta}>Client total: ${project.financials.client.total.toFixed(2)}</Text>
          <Text style={styles.meta}>Fielder pay: ${project.financials.totalFielderPay.toFixed(2)}</Text>
          <Text style={[styles.meta, { color: colors.accent }]}>
            Margin: ${project.financials.margin.toFixed(2)}
          </Text>
          {(canInvoice || canPay) && project.status === "complete" ? (
            <View style={[screenStyles.rowWrap, { marginTop: 12 }]}>
              {canInvoice ? (
                <TouchableOpacity style={styles.actionBtn} disabled={acting} onPress={generateInvoice}>
                  <Text style={styles.actionText}>Generate invoice</Text>
                </TouchableOpacity>
              ) : null}
              {canPay ? (
                <TouchableOpacity style={styles.actionBtn} disabled={acting} onPress={generatePayment}>
                  <Text style={styles.actionText}>Generate payment</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Fielders</Text>
        {project.assignments.length === 0 ? (
          <Text style={styles.meta}>Not assigned</Text>
        ) : (
          project.assignments.map((assignment) => (
            <View key={assignment.id} style={styles.assignment}>
              <Text style={styles.meta}>
                {assignment.fielder.firstName} {assignment.fielder.lastName} · $
                {assignment.fielderSqftRate}/SQFT · {assignment.status.replace(/_/g, " ")}
              </Text>
              {canWrite ? (
                <View style={[screenStyles.rowWrap, { marginTop: 8 }]}>
                  {ASSIGNMENT_STATUSES.filter((s) => s !== assignment.status).map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={styles.miniChip}
                      disabled={acting}
                      onPress={() => updateAssignment(assignment.id, status)}
                    >
                      <Text style={styles.miniChipText}>{status.replace(/_/g, " ")}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>

      {project.description ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.meta}>{project.description}</Text>
        </View>
      ) : null}

      {project.notes ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.meta}>{project.notes}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  projectNumber: {
    fontFamily: fonts.semibold,
    color: colors.accent,
    fontSize: 14,
    lineHeight: 18,
    flex: 1,
    minWidth: 0,
  },
  title: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 22, lineHeight: 28, marginTop: 10 },
  meta: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  link: { fontFamily: fonts.medium, color: colors.accent, fontSize: 14, lineHeight: 20, marginTop: 8 },
  actionBtn: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 12, lineHeight: 16 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: layout.borderRadius,
    padding: 14,
    marginTop: 16,
  },
  sectionTitle: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 15, lineHeight: 20, marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    textTransform: "capitalize",
  },
  assignment: { marginBottom: 12 },
  miniChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  miniChipText: {
    fontFamily: fonts.medium,
    color: colors.mutedForeground,
    fontSize: 10,
    lineHeight: 12,
    textTransform: "capitalize",
  },
  error: { fontFamily: fonts.medium, color: colors.danger, fontSize: 14, lineHeight: 18 },
});
