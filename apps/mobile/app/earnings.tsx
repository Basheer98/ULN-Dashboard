import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { apiRequest } from "../src/lib/api";
import { getToken } from "../src/lib/auth";
import { colors, getStatusColor } from "../src/lib/theme";
import { fonts } from "../src/lib/fonts";
import { formatStatusLabel } from "../src/lib/typography";
import { WeeklyEarningsChart } from "../src/components/WeeklyEarningsChart";
import { downloadStatementPdf } from "../src/lib/statement";

interface Payment {
  id: string;
  totalAmount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
  sqftAmount: number;
  project: { projectNumber: string; title: string; state: string | null; sqft: number } | null;
}

interface StatementLine {
  projectNumber: string;
  title: string;
  sqft: number;
  rate: number;
  total: number;
  paymentStatus: string;
}

interface FielderData {
  earnings: {
    paidTotal: number;
    pendingPayTotal: number;
    monthLabel: string;
    weekly?: { label: string; amount: number }[];
    thisMonth: { total: number; paid: number; pending: number; sqft: number; projects: number };
  };
  statement: {
    monthLabel: string;
    lines: StatementLine[];
    totals: { total: number; paid: number; pending: number; sqft: number; projects: number };
  } | null;
  recentPayments: {
    id: string;
    projectNumber: string;
    title: string;
    amount: number;
    status: string;
    paidAt: string | null;
  }[];
}

function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function EarningsScreen() {
  const [data, setData] = useState<FielderData | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      await downloadStatementPdf();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not download statement");
    } finally {
      setDownloading(false);
    }
  }

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const [profile, payList] = await Promise.all([
        apiRequest<FielderData>("/fielders/me", { token }),
        apiRequest<Payment[]>("/payments/mine", { token }),
      ]);
      setData(profile);
      setPayments(payList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const month = data?.statement;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.accent}
        />
      }
    >
      {data?.earnings.weekly && data.earnings.weekly.length > 0 && (
        <WeeklyEarningsChart weeks={data.earnings.weekly} />
      )}

      <TouchableOpacity
        style={[styles.pdfBtn, downloading && styles.pdfBtnDisabled]}
        onPress={handleDownloadPdf}
        disabled={downloading}
      >
        <Text style={styles.pdfBtnText}>
          {downloading ? "Preparing PDF..." : "Download Pay Statement (PDF)"}
        </Text>
      </TouchableOpacity>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatMoney(data?.earnings.paidTotal ?? 0)}</Text>
          <Text style={styles.summaryLabel}>All-Time Paid</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: colors.warning }]}>
            {formatMoney(data?.earnings.pendingPayTotal ?? 0)}
          </Text>
          <Text style={styles.summaryLabel}>Awaiting Payment</Text>
        </View>
      </View>

      {month && (
        <>
          <Text style={styles.sectionTitle}>{month.monthLabel} Statement</Text>
          <View style={styles.statementHeader}>
            <Text style={styles.statementMeta}>
              {month.totals.projects} projects · {month.totals.sqft.toLocaleString()} SQFT
            </Text>
            <Text style={styles.statementTotal}>{formatMoney(month.totals.total)}</Text>
          </View>
          {month.lines.length === 0 ? (
            <Text style={styles.empty}>No completed jobs this month yet.</Text>
          ) : (
            month.lines.map((line) => {
              const statusColor = getStatusColor(
                line.paymentStatus === "paid"
                  ? "paid"
                  : line.paymentStatus === "partial"
                    ? "partial"
                    : "pending"
              );
              return (
                <View key={line.projectNumber} style={styles.lineCard}>
                  <View style={styles.lineHeader}>
                    <Text style={styles.lineProject}>{line.projectNumber}</Text>
                    <View style={[styles.badge, { backgroundColor: statusColor + "22" }]}>
                      <Text style={[styles.badgeText, { color: statusColor }]}>
                        {formatStatusLabel(line.paymentStatus)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.lineTitle}>{line.title}</Text>
                  <Text style={styles.lineMeta}>
                    {line.sqft.toLocaleString()} SQFT × ${line.rate}/sqft
                  </Text>
                  <Text style={styles.lineAmount}>{formatMoney(line.total)}</Text>
                </View>
              );
            })
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Paid this month</Text>
            <Text style={[styles.totalsValue, { color: colors.success }]}>
              {formatMoney(month.totals.paid)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Pending this month</Text>
            <Text style={[styles.totalsValue, { color: colors.warning }]}>
              {formatMoney(month.totals.pending)}
            </Text>
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>All Payments</Text>
      {payments.length === 0 ? (
        <Text style={styles.empty}>No payments recorded yet.</Text>
      ) : (
        payments.map((p) => {
          const statusColor = getStatusColor(p.status);
          return (
            <View key={p.id} style={styles.lineCard}>
              <View style={styles.lineHeader}>
                <Text style={styles.lineProject}>{p.project?.projectNumber ?? "—"}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor + "22" }]}>
                  <Text style={[styles.badgeText, { color: statusColor }]}>
                    {formatStatusLabel(p.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.lineTitle}>{p.project?.title ?? "Project payment"}</Text>
              <Text style={styles.lineAmount}>{formatMoney(Number(p.totalAmount))}</Text>
              {p.paidAt && (
                <Text style={styles.lineMeta}>
                  Paid {new Date(p.paidAt).toLocaleDateString()}
                </Text>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  pdfBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  pdfBtnDisabled: { opacity: 0.6 },
  pdfBtnText: { fontFamily: fonts.semibold, color: colors.accentForeground, fontSize: 15 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryValue: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 20 },
  summaryLabel: { fontFamily: fonts.regular, color: colors.mutedForeground, fontSize: 12, marginTop: 4 },
  sectionTitle: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 10,
  },
  statementHeader: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statementMeta: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13 },
  statementTotal: { fontFamily: fonts.bold, color: colors.accent, fontSize: 24, marginTop: 4 },
  lineCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lineHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  lineProject: { fontFamily: fonts.semibold, color: colors.accent, fontSize: 14 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11 },
  lineTitle: { fontFamily: fonts.medium, color: colors.foreground, fontSize: 15, marginTop: 6 },
  lineMeta: { fontFamily: fonts.regular, color: colors.mutedForeground, fontSize: 12, marginTop: 4 },
  lineAmount: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 18, marginTop: 6 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  totalsLabel: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14 },
  totalsValue: { fontFamily: fonts.semibold, fontSize: 16 },
  empty: { fontFamily: fonts.regular, color: colors.mutedForeground, textAlign: "center", marginVertical: 20 },
});
