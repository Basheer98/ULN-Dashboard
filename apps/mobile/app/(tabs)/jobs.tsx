import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiRequest } from "../../src/lib/api";
import { getToken } from "../../src/lib/auth";
import { colors, getStatusColor } from "../../src/lib/theme";
import { StatusBadge } from "../../src/components/status-badge";
import { fonts } from "../../src/lib/fonts";
import { layout, screenStyles } from "../../src/lib/layout";
import { getEcdLabel } from "../../src/lib/dates";
import { openDirections } from "../../src/lib/maps";
import { ProjectSearchBar } from "../../src/components/project-search-bar";

interface Assignment {
  id: string;
  status: string;
  fielderSqftRate: number;
  assignedSqft?: number;
  project: {
    id: string;
    projectNumber: string;
    title: string;
    siteAddress: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    sqft: number;
    dueDate?: string | null;
    client: { name: string };
  };
}

interface JobsSummary {
  earnings: {
    paidTotal: number;
    pendingPayTotal: number;
    estimatedActive: number;
    weekly?: { label: string; amount: number }[];
  };
  jobs: { active: number; complete: number };
}

function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function JobsScreen() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [summary, setSummary] = useState<JobsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadJobs = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      const [jobs, profile] = await Promise.all([
        apiRequest<Assignment[]>("/assignments/mine", { token }),
        apiRequest<JobsSummary>("/fielders/me", { token }),
      ]);
      setAssignments(jobs);
      setSummary(profile);
    } catch {
      router.replace("/login");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadJobs();
    }, [loadJobs])
  );

  function renderHeader() {
    return (
      <View style={styles.headerSection}>
        <Text style={styles.greeting}>My Jobs</Text>
        <ProjectSearchBar placeholder="Search your assigned projects..." />
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary?.jobs.active ?? 0}</Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.accent }]}>
              {formatMoney(summary?.earnings.estimatedActive ?? 0)}
            </Text>
            <Text style={styles.summaryLabel}>Est. Pay</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>
              {formatMoney(summary?.earnings.pendingPayTotal ?? 0)}
            </Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={screenStyles.container}>
      <FlatList
        data={assignments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadJobs();
            }}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No jobs assigned yet.</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const statusColor = getStatusColor(item.status);
          const sqft = Number(item.assignedSqft ?? item.project.sqft);
          const rate = Number(item.fielderSqftRate);
          const estPay = sqft * rate;
          const ecd = getEcdLabel(item.project.dueDate);

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/jobs/${item.id}`)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.projectNumber}>{item.project.projectNumber}</Text>
                <View style={styles.badgeRow}>
                  {ecd && (
                    <View
                      style={[
                        styles.ecdBadge,
                        ecd.overdue && styles.ecdOverdue,
                        ecd.urgent && !ecd.overdue && styles.ecdUrgent,
                      ]}
                    >
                      <Text style={styles.ecdText}>{ecd.text}</Text>
                    </View>
                  )}
                  <StatusBadge label={item.status} color={statusColor} />
                </View>
              </View>
              <Text style={styles.title}>{item.project.title}</Text>
              <Text style={styles.client}>{item.project.client.name}</Text>
              <TouchableOpacity
                onPress={() =>
                  openDirections(
                    item.project.siteAddress,
                    item.project.city,
                    item.project.state,
                    item.project.zip
                  )
                }
              >
                <Text style={styles.addressLink}>
                  📍 {item.project.siteAddress}
                  {item.project.city ? `, ${item.project.city}` : ""}
                  {item.project.state ? ` ${item.project.state}` : ""}
                </Text>
              </TouchableOpacity>

              <View style={styles.payRow}>
                <View style={styles.payBlock}>
                  <Text style={styles.payLabel}>SQFT</Text>
                  <Text style={styles.payValue}>{sqft.toLocaleString()}</Text>
                </View>
                <View style={styles.payBlock}>
                  <Text style={styles.payLabel}>Rate</Text>
                  <Text style={styles.payValue}>${rate.toFixed(3)}</Text>
                </View>
                <View style={styles.payBlock}>
                  <Text style={styles.payLabel}>Est. Pay</Text>
                  <Text style={[styles.payValue, { color: colors.accent }]}>
                    {formatMoney(estPay)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: layout.screenPaddingBottom },
  headerSection: { paddingHorizontal: layout.screenPadding, paddingTop: 12, paddingBottom: 4 },
  greeting: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 22, lineHeight: 28, marginBottom: 12 },
  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: layout.borderRadiusSm,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: 64,
  },
  summaryValue: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 16, lineHeight: 20 },
  summaryLabel: { fontFamily: fonts.regular, color: colors.mutedForeground, fontSize: 10, lineHeight: 14, marginTop: 4 },
  empty: { fontFamily: fonts.regular, color: colors.mutedForeground, textAlign: "center", marginTop: 40, fontSize: 16, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: layout.screenPadding,
    marginBottom: 12,
    borderRadius: layout.borderRadius,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  badgeRow: { flexDirection: "row", gap: 6, flexShrink: 0, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },
  projectNumber: { fontFamily: fonts.semibold, color: colors.accent, fontSize: 14, lineHeight: 18, flex: 1, minWidth: 0 },
  ecdBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.info + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  ecdUrgent: { backgroundColor: colors.warning + "22" },
  ecdOverdue: { backgroundColor: colors.danger + "22" },
  ecdText: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 11, lineHeight: 14 },
  title: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 16, lineHeight: 22, marginBottom: 4 },
  client: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14, lineHeight: 18, marginBottom: 2 },
  addressLink: { fontFamily: fonts.medium, color: colors.accent, fontSize: 13, lineHeight: 18, marginTop: 2 },
  payRow: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
    alignItems: "flex-start",
  },
  payBlock: { flex: 1, minWidth: 0 },
  payLabel: {
    fontFamily: fonts.semibold,
    color: colors.mutedForeground,
    fontSize: 10,
    lineHeight: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  payValue: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 15, lineHeight: 20, marginTop: 4 },
});
