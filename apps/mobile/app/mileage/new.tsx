import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { apiRequest } from "../../src/lib/api";
import { getToken } from "../../src/lib/auth";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";

export default function NewMileageScreen() {
  const [startLocation, setStartLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [startOdometer, setStartOdometer] = useState("");
  const [endOdometer, setEndOdometer] = useState("");
  const [totalMiles, setTotalMiles] = useState("");
  const [businessPurpose, setBusinessPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function computeMiles() {
    const start = parseFloat(startOdometer);
    const end = parseFloat(endOdometer);
    if (start && end && end > start) {
      setTotalMiles((end - start).toFixed(1));
    }
  }

  async function handleSubmit() {
    const miles = parseFloat(totalMiles);
    if (!miles || miles <= 0) {
      Alert.alert("Invalid miles", "Enter total miles or odometer readings.");
      return;
    }

    setSubmitting(true);
    const token = await getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      await apiRequest("/finance/mileage", {
        method: "POST",
        token,
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          startLocation: startLocation.trim() || undefined,
          destination: destination.trim() || undefined,
          startOdometer: startOdometer ? parseFloat(startOdometer) : undefined,
          endOdometer: endOdometer ? parseFloat(endOdometer) : undefined,
          totalMiles: miles,
          businessPurpose: businessPurpose.trim() || undefined,
          isReimbursable: true,
        }),
      });

      Alert.alert("Submitted", "Mileage entry submitted for review.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to submit mileage");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Start Location</Text>
      <TextInput
        style={styles.input}
        value={startLocation}
        onChangeText={setStartLocation}
        placeholder="Denver, CO"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>Destination</Text>
      <TextInput
        style={styles.input}
        value={destination}
        onChangeText={setDestination}
        placeholder="Billings, MT"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.sectionTitle}>Odometer (optional)</Text>
      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Start</Text>
          <TextInput
            style={styles.input}
            value={startOdometer}
            onChangeText={setStartOdometer}
            onBlur={computeMiles}
            keyboardType="decimal-pad"
            placeholder="12345.0"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>End</Text>
          <TextInput
            style={styles.input}
            value={endOdometer}
            onChangeText={setEndOdometer}
            onBlur={computeMiles}
            keyboardType="decimal-pad"
            placeholder="12450.5"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
      </View>

      <Text style={styles.label}>Total Miles</Text>
      <TextInput
        style={styles.input}
        value={totalMiles}
        onChangeText={setTotalMiles}
        keyboardType="decimal-pad"
        placeholder="105.5"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={styles.label}>Business Purpose</Text>
      <TextInput
        style={styles.input}
        value={businessPurpose}
        onChangeText={setBusinessPurpose}
        placeholder="Site visit for PRJ 3455"
        placeholderTextColor={colors.mutedForeground}
      />

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>Submit Mileage</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 40 },
  label: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 14, marginBottom: 6, marginTop: 12 },
  sectionTitle: { fontFamily: fonts.semibold, color: colors.muted, fontSize: 13, marginTop: 16, marginBottom: 4 },
  input: {
    fontFamily: fonts.regular,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    color: colors.foreground,
    fontSize: 16,
  },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { fontFamily: fonts.bold, color: colors.accentForeground, fontSize: 16 },
});
