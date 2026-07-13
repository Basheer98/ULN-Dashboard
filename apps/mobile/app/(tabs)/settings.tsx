import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { apiRequest } from "../../src/lib/api";
import {
  clearSession,
  getToken,
  getUser,
  type MobileUser,
} from "../../src/lib/auth";
import { colors, getStatusColor } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";

interface FielderProfile {
  fielder: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    employmentType: string;
    region: string | null;
  };
  earnings: {
    paidTotal: number;
    pendingPayTotal: number;
    estimatedActive: number;
    monthLabel: string;
    thisMonth: { total: number; paid: number; pending: number; sqft: number; projects: number };
  };
  reimbursements: {
    pendingCount: number;
    pendingAmount: number;
    paidAmount: number;
  };
  jobs: { active: number; complete: number; total: number };
}

function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SettingsScreen() {
  const [data, setData] = useState<FielderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<MobileUser | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const savedUser = await getUser();
      setUser(savedUser);
      if (savedUser?.role !== "fielder") return;
      const profile = await apiRequest<FielderProfile>("/fielders/me", { token });
      setData(profile);
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

  async function handleLogout() {
    await clearSession();
    router.replace("/login");
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (user?.role !== "fielder") {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.role === "admin" ? "AO" : user?.role?.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>
            {user?.role === "admin" ? "Admin / Owner" : user?.role}
          </Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.tagRow}>
            <Text style={styles.tag}>{user?.role?.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/(tabs)/projects")}>
          <Text style={styles.menuTitle}>All Projects</Text>
          <Text style={styles.menuDesc}>Create, edit, assign fielders, change status</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/(tabs)/more")}>
          <Text style={styles.menuTitle}>Office Tools</Text>
          <Text style={styles.menuDesc}>Clients, fielders, schedule, invoices, finance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/expenses/new")}>
          <Text style={styles.menuTitle}>Add Company Spending</Text>
          <Text style={styles.menuDesc}>Photograph a receipt and record the expense</Text>
        </TouchableOpacity>
        {user?.role === "admin" || user?.role === "accountant" ? (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/(tabs)/approvals")}>
            <Text style={styles.menuTitle}>Review Approvals</Text>
            <Text style={styles.menuDesc}>Expenses, mileage, and fielder payments</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/(tabs)/inbox")}>
          <Text style={styles.menuTitle}>Notification Inbox</Text>
          <Text style={styles.menuDesc}>Job activity and finance submissions</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App</Text>
          <Text style={styles.infoValue}>ULN Mobile v1.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Company</Text>
          <Text style={styles.infoValue}>Urbanlink Networks LLC</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const f = data?.fielder;

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
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {f?.firstName?.[0]}
            {f?.lastName?.[0]}
          </Text>
        </View>
        <Text style={styles.name}>
          {f?.firstName} {f?.lastName}
        </Text>
        <Text style={styles.email}>{f?.email ?? "—"}</Text>
        {f?.phone && <Text style={styles.meta}>{f.phone}</Text>}
        <View style={styles.tagRow}>
          <Text style={styles.tag}>
            {f?.employmentType === "w2" ? "W-2 Employee" : "1099 Contractor"}
          </Text>
          {f?.region && <Text style={styles.tag}>{f.region}</Text>}
        </View>
      </View>

      <Text style={styles.sectionLabel}>Earnings</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatMoney(data?.earnings.paidTotal ?? 0)}</Text>
          <Text style={styles.statLabel}>Total Paid</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.warning }]}>
            {formatMoney(data?.earnings.pendingPayTotal ?? 0)}
          </Text>
          <Text style={styles.statLabel}>Pending Pay</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.accent }]}>
            {formatMoney(data?.earnings.estimatedActive ?? 0)}
          </Text>
          <Text style={styles.statLabel}>Active Jobs Est.</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {formatMoney(data?.earnings.thisMonth.pending ?? 0)}
          </Text>
          <Text style={styles.statLabel}>{data?.earnings.monthLabel || "This Month"} Pending</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/earnings")}>
        <Text style={styles.menuTitle}>Payments & Statement</Text>
        <Text style={styles.menuDesc}>View pay history and monthly breakdown</Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Reimbursements</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.warning }]}>
            {formatMoney(data?.reimbursements.pendingAmount ?? 0)}
          </Text>
          <Text style={styles.statLabel}>
            Pending ({data?.reimbursements.pendingCount ?? 0})
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.success }]}>
            {formatMoney(data?.reimbursements.paidAmount ?? 0)}
          </Text>
          <Text style={styles.statLabel}>Reimbursed</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Quick Actions</Text>
      <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/expenses/new")}>
        <Text style={styles.menuTitle}>Submit Expense</Text>
        <Text style={styles.menuDesc}>Add receipt and request reimbursement</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/(tabs)/expenses")}>
        <Text style={styles.menuTitle}>My Expenses</Text>
        <Text style={styles.menuDesc}>Track submitted expense status</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/receipts")}>
        <Text style={styles.menuTitle}>Receipt Gallery</Text>
        <Text style={styles.menuDesc}>View all uploaded receipt photos</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/mileage/new")}>
        <Text style={styles.menuTitle}>Log Mileage</Text>
        <Text style={styles.menuDesc}>Submit a new mileage entry</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/mileage")}>
        <Text style={styles.menuTitle}>Mileage History</Text>
        <Text style={styles.menuDesc}>View status of submitted mileage</Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Jobs</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data?.jobs.active ?? 0}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data?.jobs.complete ?? 0}</Text>
          <Text style={styles.statLabel}>Complete</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>App</Text>
        <Text style={styles.infoValue}>ULN Field v1.0</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Company</Text>
        <Text style={styles.infoValue}>Urbanlink Networks LLC</Text>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent + "33",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: { fontFamily: fonts.bold, color: colors.accent, fontSize: 22 },
  name: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 22 },
  email: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14, marginTop: 4 },
  meta: { fontFamily: fonts.regular, color: colors.mutedForeground, fontSize: 13, marginTop: 2 },
  tagRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  tag: {
    fontFamily: fonts.medium,
    backgroundColor: colors.surfaceElevated,
    color: colors.muted,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    color: colors.mutedForeground,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 8,
  },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 18 },
  statLabel: { fontFamily: fonts.regular, color: colors.mutedForeground, fontSize: 11, marginTop: 4 },
  menuItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuTitle: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 16 },
  menuDesc: { fontFamily: fonts.regular, color: colors.mutedForeground, fontSize: 13, marginTop: 4 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14 },
  infoValue: { fontFamily: fonts.medium, color: colors.foreground, fontSize: 14 },
  logoutBtn: {
    marginTop: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  logoutText: { fontFamily: fonts.semibold, color: colors.danger, fontSize: 16 },
});
