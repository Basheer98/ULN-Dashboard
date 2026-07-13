import { useState, useEffect } from "react";
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

interface Category {
  id: string;
  name: string;
}

interface Assignment {
  project: { id: string; projectNumber: string; title: string };
}

export default function NewExpenseScreen() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [businessPurpose, setBusinessPurpose] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isReimbursable, setIsReimbursable] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Assignment[]>([]);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isOffice, setIsOffice] = useState(false);

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
        /* categories may require admin - fielders use defaults */
      }
    })();
  }, []);

  async function pickReceipt() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
      setReceiptName(result.assets[0].fileName ?? "receipt.jpg");
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
      setReceiptUri(result.assets[0].uri);
      setReceiptName(result.assets[0].fileName ?? "receipt.jpg");
    }
  }

  async function handleSubmit() {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid expense amount.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Description required", "Please describe the expense.");
      return;
    }

    setSubmitting(true);
    const token = await getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      const expense = await apiRequest<{ id: string }>(
        isOffice ? "/finance/expenses" : "/finance/expenses/mine",
        {
        method: "POST",
        token,
        body: JSON.stringify({
          transactionDate: new Date().toISOString().slice(0, 10),
          amount: parsedAmount,
          description: description.trim(),
          businessPurpose: businessPurpose.trim() || undefined,
          categoryId,
          projectId,
          paidBy: isOffice && !isReimbursable ? "company" : "employee",
          isReimbursable,
          expenseStatus: isOffice ? "approved" : undefined,
        }),
      });

      if (receiptUri) {
        const form = new FormData();
        form.append("transactionId", expense.id);
        form.append("file", {
          uri: receiptUri,
          name: receiptName ?? "receipt.jpg",
          type: "image/jpeg",
        } as unknown as Blob);

        const receiptResponse = await fetch(`${API_URL}/finance/receipts`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!receiptResponse.ok) {
          const receiptError = await receiptResponse.json().catch(() => ({}));
          throw new Error(receiptError.error || "Expense saved, but receipt upload failed");
        }
      }

      Alert.alert(
        isOffice ? "Expense saved" : "Submitted",
        isOffice
          ? "Company spending and receipt were added to finance."
          : "Your expense has been submitted for review.",
        [
        { text: "OK", onPress: () => router.back() },
        ]
      );
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to submit expense");
    } finally {
      setSubmitting(false);
    }
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

      <Text style={styles.label}>Receipt</Text>
      <View style={styles.receiptRow}>
        <TouchableOpacity style={styles.receiptBtn} onPress={takePhoto}>
          <Text style={styles.receiptBtnText}>📷 Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.receiptBtn} onPress={pickReceipt}>
          <Text style={styles.receiptBtnText}>🖼 Choose Photo</Text>
        </TouchableOpacity>
      </View>
      {receiptUri && (
        <Image source={{ uri: receiptUri }} style={styles.preview} resizeMode="cover" />
      )}

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>
            {isOffice ? "Save Company Expense" : "Submit Expense"}
          </Text>
        )}
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
  receiptBtnText: { fontFamily: fonts.medium, color: colors.foreground, fontSize: 14, lineHeight: 18, textAlign: "center" },
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
});
