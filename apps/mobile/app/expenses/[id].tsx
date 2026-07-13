import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { apiRequest } from "../../src/lib/api";
import { getToken } from "../../src/lib/auth";
import { colors, getStatusColor } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";
import { AuthenticatedImage } from "../../src/components/AuthenticatedImage";

interface ExpenseDetail {
  id: string;
  transactionNumber: string;
  transactionDate: string;
  amount: number;
  description: string | null;
  businessPurpose: string | null;
  expenseStatus: string | null;
  isReimbursable: boolean;
  reviewReason: string | null;
  reimbursedAt: string | null;
  category: { name: string } | null;
  project: { projectNumber: string; title: string } | null;
  receipts: {
    id: string;
    originalFileName: string;
    storedFileName: string;
    mimeType: string;
    verificationStatus: string;
  }[];
}

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token || !id) return;
      try {
        const data = await apiRequest<ExpenseDetail>(`/finance/expenses/${id}`, { token });
        setExpense(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!expense) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Expense not found.</Text>
      </View>
    );
  }

  const status = expense.expenseStatus ?? "submitted";
  const statusColor = getStatusColor(status);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.amount}>${Number(expense.amount).toFixed(2)}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor + "22" }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {status.replace(/_/g, " ")}
          </Text>
        </View>
      </View>

      <Text style={styles.number}>{expense.transactionNumber}</Text>
      <Text style={styles.date}>
        {new Date(expense.transactionDate).toLocaleDateString()}
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.sectionText}>{expense.description || "—"}</Text>
      </View>

      {expense.businessPurpose && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Purpose</Text>
          <Text style={styles.sectionText}>{expense.businessPurpose}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Category</Text>
        <Text style={styles.sectionText}>{expense.category?.name ?? "Uncategorized"}</Text>
      </View>

      {expense.project && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project</Text>
          <Text style={styles.sectionText}>
            {expense.project.projectNumber} — {expense.project.title}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reimbursement</Text>
        <Text style={styles.sectionText}>
          {expense.isReimbursable ? "Requested" : "Not requested"}
        </Text>
        {expense.reimbursedAt && (
          <Text style={styles.sectionText}>
            Paid: {new Date(expense.reimbursedAt).toLocaleDateString()}
          </Text>
        )}
      </View>

      {expense.reviewReason && (
        <View style={[styles.section, styles.rejectedBox]}>
          <Text style={styles.sectionTitle}>Review Note</Text>
          <Text style={styles.sectionText}>{expense.reviewReason}</Text>
        </View>
      )}

      {expense.receipts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.receiptHeader}>
            <Text style={styles.sectionTitle}>Receipts ({expense.receipts.length})</Text>
            <TouchableOpacity onPress={() => router.push("/receipts")}>
              <Text style={styles.viewAll}>View Gallery</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {expense.receipts.map((r) => (
              <View key={r.id} style={styles.receiptThumb}>
                <AuthenticatedImage
                  fileKey={r.storedFileName}
                  mimeType={r.mimeType}
                  style={styles.receiptImage}
                />
                <Text style={styles.receiptItem} numberOfLines={1}>
                  {r.verificationStatus}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  empty: { color: colors.mutedForeground },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  amount: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 32 },
  badge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 13, textTransform: "capitalize" },
  number: { color: colors.muted, fontSize: 13, marginTop: 4 },
  date: { color: colors.mutedForeground, fontSize: 13, marginBottom: 16 },
  section: { marginTop: 16, padding: 14, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontFamily: fonts.semibold, color: colors.muted, fontSize: 12, textTransform: "uppercase", marginBottom: 6 },
  sectionText: { color: colors.foreground, fontSize: 15 },
  rejectedBox: { borderColor: "#ef4444" },
  receiptHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  viewAll: { fontFamily: fonts.semibold, color: colors.accent, fontSize: 13 },
  receiptThumb: { marginRight: 10, width: 120 },
  receiptImage: { width: 120, height: 120, borderRadius: 8 },
  receiptItem: { color: colors.mutedForeground, fontSize: 11, marginTop: 4, textTransform: "capitalize" },
});
