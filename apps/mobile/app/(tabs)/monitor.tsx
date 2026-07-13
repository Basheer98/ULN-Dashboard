import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getToken } from "../../src/lib/auth";
import { loadOfficeSummary, type OfficeSummary } from "../../src/lib/office";
import { colors, getStatusColor } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";
import { layout, screenStyles, textStyles } from "../../src/lib/layout";
import { ProjectSearchBar } from "../../src/components/project-search-bar";
import { MetricGrid } from "../../src/components/metric-grid";
import { StatusBadge } from "../../src/components/status-badge";

export default function MonitorScreen() {
  const [data, setData] = useState<OfficeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      setError("");
      setData(await loadOfficeSummary(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load monitor");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

  if (loading && !data) {
    return (
      <View style={screenStyles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const approvalCount =
    (data?.counts.pendingExpenses ?? 0) +
    (data?.counts.pendingMileage ?? 0) +
    (data?.counts.pendingPayments ?? 0);

  return (
    <ScrollView
      style={screenStyles.container}
      contentContainerStyle={screenStyles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.accent}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <Text style={styles.eyebrow}>OWNER COMMAND CENTER</Text>
      <Text style={textStyles.heading}>Business overview</Text>
      <Text style={textStyles.subheading}>Live operations and items needing attention.</Text>

      <View style={styles.searchWrap}>
        <ProjectSearchBar placeholder="Search any project by number, client, or address..." />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <MetricGrid
        items={[
          { label: "Active Jobs", value: data?.counts.activeProjects ?? 0 },
          { label: "Done Today", value: data?.counts.completedToday ?? 0, color: colors.success },
          { label: "Approvals", value: approvalCount, color: colors.warning },
          { label: "Unread", value: data?.counts.unreadNotifications ?? 0, color: colors.info },
        ]}
      />

      <View style={screenStyles.actionRow}>
        <TouchableOpacity
          style={[screenStyles.actionBtn, styles.primaryAction]}
          onPress={() => router.push("/(tabs)/projects")}
        >
          <Text style={styles.primaryActionText}>All projects</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[screenStyles.actionBtn, styles.secondaryAction]}
          onPress={() => router.push("/projects/new")}
        >
          <Text style={styles.secondaryActionText}>+ New project</Text>
        </TouchableOpacity>
      </View>
      <View style={screenStyles.actionRow}>
        <TouchableOpacity
          style={[screenStyles.actionBtn, styles.secondaryAction]}
          onPress={() => router.push("/(tabs)/approvals")}
        >
          <Text style={styles.secondaryActionText}>Review approvals</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[screenStyles.actionBtn, styles.secondaryAction]}
          onPress={() => router.push("/(tabs)/more")}
        >
          <Text style={styles.secondaryActionText}>Office tools</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent projects</Text>
      {data?.recentProjects.length ? (
        data.recentProjects.map((project) => {
          const statusColor = getStatusColor(project.status);
          return (
            <TouchableOpacity
              key={project.id}
              style={styles.card}
              onPress={() => router.push(`/projects/${project.id}`)}
              activeOpacity={0.8}
            >
              <View style={screenStyles.rowBetween}>
                <Text style={styles.projectNumber} numberOfLines={1}>
                  {project.projectNumber}
                </Text>
                <StatusBadge label={project.status} color={statusColor} />
              </View>
              <Text style={styles.projectTitle} numberOfLines={2}>
                {project.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {project.clientName}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {project.fielders.length ? project.fielders.join(", ") : "Not assigned"}
              </Text>
            </TouchableOpacity>
          );
        })
      ) : (
        <Text style={styles.empty}>No active projects.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.bold,
    color: colors.accent,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
  },
  searchWrap: { marginTop: 14 },
  error: { fontFamily: fonts.medium, color: colors.danger, marginTop: 12, lineHeight: 18 },
  primaryAction: { backgroundColor: colors.accent, borderWidth: 0 },
  primaryActionText: {
    fontFamily: fonts.semibold,
    color: colors.accentForeground,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  secondaryAction: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
    fontSize: 17,
    lineHeight: 22,
    marginTop: 26,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: layout.borderRadius,
    padding: 15,
    marginBottom: 10,
  },
  projectNumber: {
    fontFamily: fonts.semibold,
    color: colors.accent,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    minWidth: 0,
  },
  projectTitle: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
    fontSize: 15,
    lineHeight: 20,
    marginTop: 8,
  },
  meta: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  empty: {
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
    textAlign: "center",
    marginTop: 30,
    lineHeight: 20,
  },
});
