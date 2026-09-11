import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Image,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { apiRequest, API_URL } from "../../src/lib/api";
import { getToken, getUser } from "../../src/lib/auth";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";
import { layout, screenStyles } from "../../src/lib/layout";
import { looksLikeOfflineError, saveExpenseDraft } from "../../src/lib/offline-queue";

interface Category {
  id: string;
  name: string;
}

interface Assignment {
  project: { id: string; projectNumber: string; title: string };
}

interface DuplicateMatch {
  id: string;
  transactionNumber: string;
  amount: number;
  transactionDate: string;
  description: string | null;
  confidence: "exact" | "likely";
}

interface ScanResponse {
  receipt: { id: string };
  ocr: {
    amount: number | null;
    transactionDate: string | null;
    vendorName: string | null;
    ok?: boolean;
    error?: string | null;
  };
  ocrOk?: boolean;
  ocrError?: string | null;
  suggestions?: {
    categorySuggestion?: { categoryId: string | null; vendorId: string | null };
    duplicates?: DuplicateMatch[];
  };
}

export default function NewExpenseScreen() {
  const [amount, setAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [businessPurpose, setBusinessPurpose] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isReimbursable, setIsReimbursable] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Assignment[]>([]);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [receiptRequiredAbove, setReceiptRequiredAbove] = useState(25);
  const [submitting, setSubmitting] = useState(false);
  const [isOffice, setIsOffice] = useState(false);

  const refreshSuggestions = useCallback(
    async (token: string, nextAmount: string, nextDate: string, nextDescription: string) => {
      const parsedAmount = parseFloat(nextAmount);
      if (!parsedAmount || parsedAmount <= 0) {
        setDuplicates([]);
        return;
      }
      try {
        const data = await apiRequest<{
          duplicates: DuplicateMatch[];
          categorySuggestion?: { categoryId: string | null };
          policy?: { receiptRequiredAbove: number };
        }>("/finance/expenses/suggest", {
          method: "POST",
          token,
          body: JSON.stringify({
            amount: parsedAmount,
            transactionDate: nextDate,
            description: nextDescription || undefined,
          }),
        });
        setDuplicates(data.duplicates ?? []);
        if (data.policy?.receiptRequiredAbove) {
          setReceiptRequiredAbove(Number(data.policy.receiptRequiredAbove));
        }
        if (data.categorySuggestion?.categoryId && !categoryId) {
          setCategoryId(data.categorySuggestion.categoryId);
        }
      } catch {
        /* suggestions are optional */
      }
    },
    [categoryId]
  );

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const user = await getUser();
        const office = user?.role !== "fielder";
        setIsOffice(office);
        if (office) setIsReimbursable(false);

        const [cats, projectData] = await Promise.all([
          apiRequest<Category[]>("/finance/categories", { token }),
          office
            ? apiRequest<Array<{ id: string; projectNumber: string; title: string }>>(
                "/projects",
                { token }
              )
            : apiRequest<Assignment[]>("/assignments/mine", { token }),
        ]);
        setCategories(cats);
        setProjects(
          office
            ? (projectData as Array<{ id: string; projectNumber: string; title: string }>).map(
                (project) => ({ project })
              )
            : (projectData as Assignment[])
        );
      } catch {
        /* categories may fail silently on older builds */
      }
    })();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const token = await getToken();
      if (!token) return;
      timer = setTimeout(() => {
        void refreshSuggestions(token, amount, transactionDate, description);
      }, 500);
    })();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [amount, transactionDate, description, refreshSuggestions]);

  async function scanReceipt(uri: string, name: string) {
    const token = await getToken();
    if (!token) return;

    setScanning(true);
    try {
      const form = new FormData();
      form.append("file", {
        uri,
        name,
        type: "image/jpeg",
      } as unknown as Blob);
      if (projectId) form.append("projectId", projectId);

      const response = await fetch(`${API_URL}/finance/receipts/scan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = (await response.json()) as ScanResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Receipt scan failed");

      setReceiptId(data.receipt.id);
      if (data.ocr.amount) setAmount(String(data.ocr.amount));
      if (data.ocr.transactionDate) setTransactionDate(data.ocr.transactionDate);
      if (data.ocr.vendorName) setDescription(data.ocr.vendorName);
      if (data.suggestions?.categorySuggestion?.categoryId) {
        setCategoryId(data.suggestions.categorySuggestion.categoryId);
      }
      if (data.suggestions?.duplicates) {
        setDuplicates(data.suggestions.duplicates);
      }

      const ocrError = data.ocrError || data.ocr?.error;
      if (ocrError) {
        Alert.alert("OCR incomplete", ocrError);
      }
    } catch (e) {
      // Keep local photo so the expense can still be saved offline
      Alert.alert(
        "Couldn’t scan right now",
        looksLikeOfflineError(e)
          ? "Photo saved on this device. You can still submit or save a draft offline."
          : e instanceof Error
            ? e.message
            : "Could not scan receipt"
      );
    } finally {
      setScanning(false);
    }
  }

  async function pickReceipt() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const name = result.assets[0].fileName ?? "receipt.jpg";
      setReceiptUri(uri);
      setReceiptName(name);
      await scanReceipt(uri, name);
    }
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera access is required to photograph receipts.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const name = result.assets[0].fileName ?? "receipt.jpg";
      setReceiptUri(uri);
      setReceiptName(name);
      await scanReceipt(uri, name);
    }
  }

  async function persistOfflineDraft() {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0 || !description.trim()) {
      Alert.alert("Incomplete", "Amount and description are required to save a draft.");
      return;
    }
    if (parsedAmount >= receiptRequiredAbove && !receiptUri) {
      Alert.alert(
        "Receipt required",
        `Attach a receipt photo before saving (required at $${receiptRequiredAbove.toFixed(2)}+).`
      );
      return;
    }

    await saveExpenseDraft({
      payload: {
        transactionDate,
        amount: parsedAmount,
        description: description.trim(),
        businessPurpose: businessPurpose.trim() || undefined,
        categoryId,
        projectId,
        paidBy: isOffice && !isReimbursable ? "company" : "employee",
        isReimbursable,
        expenseStatus: isOffice ? "approved" : undefined,
        isOffice,
      },
      receiptUri,
      receiptName,
    });
    Alert.alert(
      "Saved on device",
      "This expense will sync when you have signal again.",
      [{ text: "OK", onPress: () => router.back() }]
    );
  }

  async function submitExpense(acknowledgeDuplicate = false) {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid expense amount.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Description required", "Please describe the expense.");
      return;
    }
    if (parsedAmount >= receiptRequiredAbove && !receiptId && !receiptUri) {
      Alert.alert(
        "Receipt required",
        `Expenses of $${receiptRequiredAbove.toFixed(2)} or more require a receipt photo.`
      );
      return;
    }

    setSubmitting(true);
    const token = await getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      let activeReceiptId = receiptId;
      if (!activeReceiptId && receiptUri) {
        const form = new FormData();
        form.append("file", {
          uri: receiptUri,
          name: receiptName ?? "receipt.jpg",
          type: "image/jpeg",
        } as unknown as Blob);
        if (projectId) form.append("projectId", projectId);

        const scanResponse = await fetch(`${API_URL}/finance/receipts/scan`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const scanData = (await scanResponse.json()) as ScanResponse & { error?: string };
        if (!scanResponse.ok) {
          throw new Error(scanData.error || "Receipt upload failed");
        }
        activeReceiptId = scanData.receipt.id;
        setReceiptId(activeReceiptId);
      }

      await apiRequest<{ id: string }>(
        isOffice ? "/finance/expenses" : "/finance/expenses/mine",
        {
          method: "POST",
          token,
          body: JSON.stringify({
            transactionDate,
            amount: parsedAmount,
            description: description.trim(),
            businessPurpose: businessPurpose.trim() || undefined,
            categoryId,
            projectId,
            paidBy: isOffice && !isReimbursable ? "company" : "employee",
            isReimbursable,
            expenseStatus: isOffice ? "approved" : undefined,
            receiptId: activeReceiptId,
            acknowledgeDuplicate: acknowledgeDuplicate || undefined,
          }),
        }
      );

      Alert.alert(
        isOffice ? "Expense saved" : "Submitted",
        isOffice
          ? "Company spending and receipt were added to finance."
          : "Your expense has been submitted for review.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to submit expense";
      if (message.toLowerCase().includes("duplicate") && !acknowledgeDuplicate) {
        Alert.alert("Possible duplicate", message, [
          { text: "Cancel", style: "cancel" },
          { text: "Submit anyway", onPress: () => void submitExpense(true) },
        ]);
      } else if (looksLikeOfflineError(e)) {
        Alert.alert("No signal", "Save this expense on your phone and sync later?", [
          { text: "Cancel", style: "cancel" },
          { text: "Save offline", onPress: () => void persistOfflineDraft() },
        ]);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit() {
    if (duplicates.length > 0) {
      Alert.alert(
        "Possible duplicate",
        `Similar expense${duplicates.length > 1 ? "s" : ""} found (${duplicates[0]?.transactionNumber}). Submit anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Submit", onPress: () => void submitExpense(true) },
        ]
      );
      return;
    }
    void submitExpense(false);
  }

  return (
    <ScrollView style={screenStyles.container} contentContainerStyle={screenStyles.content}>
      <Text style={styles.label}>Amount ($)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>Date</Text>
      <TextInput
        style={styles.input}
        value={transactionDate}
        onChangeText={setTransactionDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="What was purchased?"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>Business Purpose</Text>
      <TextInput
        style={styles.input}
        value={businessPurpose}
        onChangeText={setBusinessPurpose}
        placeholder="Why was this expense necessary?"
        placeholderTextColor={colors.mutedForeground}
      />

      {categories.length > 0 && (
        <>
          <Text style={styles.label}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={screenStyles.chipScrollContent}
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, categoryId === cat.id && styles.chipActive]}
                onPress={() => setCategoryId(cat.id)}
              >
                <Text
                  style={[styles.chipText, categoryId === cat.id && styles.chipTextActive]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {projects.length > 0 && (
        <>
          <Text style={styles.label}>Project (optional)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={screenStyles.chipScrollContent}
          >
            <TouchableOpacity
              style={[styles.chip, !projectId && styles.chipActive]}
              onPress={() => setProjectId(null)}
            >
              <Text style={[styles.chipText, !projectId && styles.chipTextActive]}>None</Text>
            </TouchableOpacity>
            {projects.map((a) => (
              <TouchableOpacity
                key={a.project.id}
                style={[styles.chip, projectId === a.project.id && styles.chipActive]}
                onPress={() => setProjectId(a.project.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    projectId === a.project.id && styles.chipTextActive,
                  ]}
                >
                  {a.project.projectNumber}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>
          {isOffice ? "I paid personally" : "Request Reimbursement"}
        </Text>
        <Switch
          value={isReimbursable}
          onValueChange={setIsReimbursable}
          trackColor={{ true: colors.accent }}
        />
      </View>

      {duplicates.length > 0 && (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Possible duplicate</Text>
          {duplicates.map((dup) => (
            <Text key={dup.id} style={styles.warningText}>
              {dup.transactionNumber} — ${dup.amount.toFixed(2)} on {dup.transactionDate}
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.label}>Receipt</Text>
      {parseFloat(amount) >= receiptRequiredAbove && !receiptUri && (
        <Text style={styles.policyHint}>
          Receipt required for amounts ≥ ${receiptRequiredAbove.toFixed(2)}
        </Text>
      )}
      <View style={styles.receiptRow}>
        <TouchableOpacity style={styles.receiptBtn} onPress={takePhoto} disabled={scanning}>
          <Text style={styles.receiptBtnText}>📷 Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.receiptBtn} onPress={pickReceipt} disabled={scanning}>
          <Text style={styles.receiptBtnText}>🖼 Choose Photo</Text>
        </TouchableOpacity>
      </View>
      {scanning && (
        <View style={styles.scanningRow}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.scanningText}>Scanning receipt…</Text>
        </View>
      )}
      {receiptUri && (
        <Image source={{ uri: receiptUri }} style={styles.preview} resizeMode="cover" />
      )}

      <TouchableOpacity
        style={[styles.submitBtn, (submitting || scanning) && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting || scanning}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>
            {isOffice ? "Save Company Expense" : "Submit Expense"}
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.draftBtn}
        onPress={() => void persistOfflineDraft()}
        disabled={submitting || scanning}
      >
        <Text style={styles.draftBtnText}>Save draft offline</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    ...screenStyles.input,
    fontSize: 16,
    marginBottom: 0,
  },
  chipScroll: { marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    minHeight: layout.chipHeight,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.medium, color: colors.muted, fontSize: 13, lineHeight: 18 },
  chipTextActive: { fontFamily: fonts.semibold, color: colors.accentForeground },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },
  switchLabel: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 18,
    flex: 1,
  },
  warningBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: "rgba(234, 179, 8, 0.1)",
  },
  warningTitle: {
    fontFamily: fonts.semibold,
    color: colors.warning,
    marginBottom: 4,
  },
  warningText: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 13,
  },
  policyHint: {
    fontFamily: fonts.medium,
    color: colors.warning,
    fontSize: 12,
    marginBottom: 6,
  },
  receiptRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  receiptBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.borderRadiusSm,
    minHeight: layout.buttonMinHeight,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  receiptBtnText: {
    fontFamily: fonts.medium,
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
  },
  scanningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  scanningText: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 13,
  },
  preview: { width: "100%", height: 180, borderRadius: layout.borderRadiusSm, marginTop: 12 },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: layout.borderRadiusSm,
    minHeight: layout.buttonMinHeight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    paddingHorizontal: 16,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontFamily: fonts.bold, color: colors.accentForeground, fontSize: 16, lineHeight: 20 },
  draftBtn: {
    marginTop: 12,
    marginBottom: 24,
    minHeight: layout.buttonMinHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: layout.borderRadiusSm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  draftBtnText: {
    fontFamily: fonts.semibold,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 18,
  },
});
