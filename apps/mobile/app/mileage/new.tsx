import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { apiRequest, API_URL } from "../../src/lib/api";
import { getToken } from "../../src/lib/auth";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";
import { layout, screenStyles } from "../../src/lib/layout";
import { looksLikeOfflineError, saveMileageDraft } from "../../src/lib/offline-queue";

interface PhotoState {
  id: string | null;
  uri: string;
}

type Step = 1 | 2;

export default function NewMileageScreen() {
  const [step, setStep] = useState<Step>(1);
  const [startOdometer, setStartOdometer] = useState("");
  const [endOdometer, setEndOdometer] = useState("");
  const [startPhoto, setStartPhoto] = useState<PhotoState | null>(null);
  const [endPhoto, setEndPhoto] = useState<PhotoState | null>(null);
  const [notes, setNotes] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [startLocation, setStartLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const totalMiles = useMemo(() => {
    const start = parseFloat(startOdometer);
    const end = parseFloat(endOdometer);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return Math.round((end - start) * 10) / 10;
  }, [startOdometer, endOdometer]);

  async function uploadPhoto(
    kind: "start_odometer" | "end_odometer",
    uri: string,
    name: string,
    odometer: string
  ) {
    const token = await getToken();
    if (!token) {
      router.replace("/login");
      return null;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("date", new Date().toISOString().slice(0, 10));
      if (odometer.trim()) form.append("odometer", odometer.trim());
      form.append("file", {
        uri,
        name,
        type: "image/jpeg",
      } as unknown as Blob);

      const response = await fetch(`${API_URL}/finance/mileage/photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Photo upload failed");
      return { id: data.id as string, uri };
    } catch (e) {
      // Keep the photo locally so the trip can continue offline
      if (looksLikeOfflineError(e)) {
        return { id: null, uri };
      }
      Alert.alert("Photo upload failed", e instanceof Error ? e.message : "Try again");
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function snapPhoto(kind: "start_odometer" | "end_odometer") {
    const odometer = kind === "start_odometer" ? startOdometer : endOdometer;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera needed", "Allow camera access to photograph the odometer.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    const uploaded = await uploadPhoto(
      kind,
      result.assets[0].uri,
      result.assets[0].fileName ?? `${kind}.jpg`,
      odometer
    );
    if (!uploaded) return;
    if (!uploaded.id) {
      Alert.alert(
        "Saved on device",
        "Weak signal — photo kept locally. Finish the trip and we’ll sync when online."
      );
    }
    if (kind === "start_odometer") setStartPhoto(uploaded);
    else setEndPhoto(uploaded);
  }

  function goNext() {
    const start = parseFloat(startOdometer);
    if (!Number.isFinite(start) || start < 0) {
      Alert.alert("Enter start reading", "Type the odometer number, then take the photo.");
      return;
    }
    if (!startPhoto) {
      Alert.alert("Photo required", "Snap a clear photo of the starting odometer.");
      return;
    }
    setStep(2);
  }

  async function handleSubmit() {
    const start = parseFloat(startOdometer);
    const end = parseFloat(endOdometer);

    if (!Number.isFinite(end) || end <= start) {
      Alert.alert("Enter end reading", "End odometer must be greater than start.");
      return;
    }
    if (!endPhoto) {
      Alert.alert("Photo required", "Snap a clear photo of the ending odometer.");
      return;
    }
    if (!startPhoto || !totalMiles) {
      Alert.alert("Incomplete", "Go back and finish the start step.");
      return;
    }

    setSubmitting(true);
    const token = await getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      let startId = startPhoto.id;
      let endId = endPhoto.id;

      if (!startId) {
        const uploaded = await uploadPhoto(
          "start_odometer",
          startPhoto.uri,
          "start.jpg",
          String(start)
        );
        if (!uploaded?.id) throw new Error("network");
        startId = uploaded.id;
        setStartPhoto(uploaded);
      }
      if (!endId) {
        const uploaded = await uploadPhoto(
          "end_odometer",
          endPhoto.uri,
          "end.jpg",
          String(end)
        );
        if (!uploaded?.id) throw new Error("network");
        endId = uploaded.id;
        setEndPhoto(uploaded);
      }

      await apiRequest("/finance/mileage", {
        method: "POST",
        token,
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          startLocation: startLocation.trim() || undefined,
          destination: destination.trim() || undefined,
          startOdometer: start,
          endOdometer: end,
          businessPurpose: notes.trim() || undefined,
          isReimbursable: true,
          startPhotoId: startId,
          endPhotoId: endId,
        }),
      });

      Alert.alert("Submitted", `${totalMiles.toFixed(1)} miles sent for review.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      if (looksLikeOfflineError(e) || (e instanceof Error && e.message === "network")) {
        Alert.alert("No signal", "Save this trip on your phone and sync later?", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save offline",
            onPress: () =>
              void (async () => {
                await saveMileageDraft({
                  payload: {
                    date: new Date().toISOString().slice(0, 10),
                    startLocation: startLocation.trim() || undefined,
                    destination: destination.trim() || undefined,
                    startOdometer: start,
                    endOdometer: end,
                    businessPurpose: notes.trim() || undefined,
                  },
                  startPhotoUri: startPhoto.uri,
                  endPhotoUri: endPhoto.uri,
                });
                Alert.alert("Saved on device", "Mileage will sync when you’re back online.", [
                  { text: "OK", onPress: () => router.back() },
                ]);
              })(),
          },
        ]);
      } else {
        Alert.alert("Error", e instanceof Error ? e.message : "Failed to submit mileage");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const busy = uploading || submitting;

  return (
    <ScrollView style={screenStyles.container} contentContainerStyle={screenStyles.content}>
      <View style={styles.progressRow}>
        <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
        <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
        <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]} />
      </View>
      <Text style={styles.stepLabel}>{step === 1 ? "1. Trip start" : "2. Trip end"}</Text>
      <Text style={styles.stepHint}>
        {step === 1
          ? "Enter the starting miles, then snap the odometer."
          : "Enter the ending miles, snap the odometer, and submit."}
      </Text>

      {step === 1 ? (
        <>
          <Text style={styles.label}>Start odometer</Text>
          <TextInput
            style={styles.input}
            value={startOdometer}
            onChangeText={setStartOdometer}
            keyboardType="decimal-pad"
            placeholder="e.g. 12345.0"
            placeholderTextColor={colors.mutedForeground}
          />

          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={() => void snapPhoto("start_odometer")}
            disabled={busy}
          >
            {uploading ? (
              <ActivityIndicator color={colors.accentForeground} />
            ) : (
              <Text style={styles.cameraBtnText}>
                {startPhoto ? "Retake start photo" : "Snap start odometer"}
              </Text>
            )}
          </TouchableOpacity>
          {startPhoto ? (
            <Image source={{ uri: startPhoto.uri }} style={styles.preview} resizeMode="cover" />
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, busy && styles.disabled]}
            onPress={goNext}
            disabled={busy}
          >
            <Text style={styles.primaryBtnText}>Next</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryChipText}>Start: {startOdometer || "—"}</Text>
          </View>

          <Text style={styles.label}>End odometer</Text>
          <TextInput
            style={styles.input}
            value={endOdometer}
            onChangeText={setEndOdometer}
            keyboardType="decimal-pad"
            placeholder="e.g. 12450.5"
            placeholderTextColor={colors.mutedForeground}
          />

          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={() => void snapPhoto("end_odometer")}
            disabled={busy}
          >
            {uploading ? (
              <ActivityIndicator color={colors.accentForeground} />
            ) : (
              <Text style={styles.cameraBtnText}>
                {endPhoto ? "Retake end photo" : "Snap end odometer"}
              </Text>
            )}
          </TouchableOpacity>
          {endPhoto ? (
            <Image source={{ uri: endPhoto.uri }} style={styles.preview} resizeMode="cover" />
          ) : null}

          <View style={styles.milesBox}>
            <Text style={styles.milesLabel}>Miles to submit</Text>
            <Text style={styles.milesValue}>
              {totalMiles != null ? totalMiles.toFixed(1) : "—"}
            </Text>
          </View>

          <TouchableOpacity onPress={() => setShowDetails((v) => !v)}>
            <Text style={styles.optionalToggle}>
              {showDetails ? "Hide optional details" : "Add route / notes (optional)"}
            </Text>
          </TouchableOpacity>

          {showDetails ? (
            <View style={styles.optionalBlock}>
              <Text style={styles.label}>Start location</Text>
              <TextInput
                style={styles.input}
                value={startLocation}
                onChangeText={setStartLocation}
                placeholder="Optional"
                placeholderTextColor={colors.mutedForeground}
              />
              <Text style={styles.label}>Destination</Text>
              <TextInput
                style={styles.input}
                value={destination}
                onChangeText={setDestination}
                placeholder="Optional"
                placeholderTextColor={colors.mutedForeground}
              />
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={styles.input}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setStep(1)}
              disabled={busy}
            >
              <Text style={styles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, styles.primaryBtnFlex, busy && styles.disabled]}
              onPress={() => void handleSubmit()}
              disabled={busy}
            >
              {submitting ? (
                <ActivityIndicator color={colors.accentForeground} />
              ) : (
                <Text style={styles.primaryBtnText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    gap: 0,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  progressDotActive: { backgroundColor: colors.accent },
  progressLine: {
    width: 64,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 6,
  },
  progressLineActive: { backgroundColor: colors.accent },
  stepLabel: {
    fontFamily: fonts.bold,
    color: colors.foreground,
    fontSize: 22,
    lineHeight: 28,
    textAlign: "center",
  },
  stepHint: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 8,
  },
  label: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    ...screenStyles.input,
    fontSize: 18,
    marginBottom: 0,
  },
  cameraBtn: {
    marginTop: 16,
    backgroundColor: colors.accent,
    borderRadius: layout.borderRadius,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  cameraBtnText: {
    fontFamily: fonts.bold,
    color: colors.accentForeground,
    fontSize: 16,
    lineHeight: 20,
  },
  preview: {
    width: "100%",
    height: 180,
    borderRadius: layout.borderRadius,
    marginTop: 12,
  },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: layout.borderRadius,
    minHeight: layout.buttonMinHeight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryBtnFlex: { flex: 1, marginTop: 0 },
  primaryBtnText: {
    fontFamily: fonts.semibold,
    color: colors.accent,
    fontSize: 16,
    lineHeight: 20,
  },
  secondaryBtn: {
    flex: 0.55,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.borderRadius,
    minHeight: layout.buttonMinHeight,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  secondaryBtnText: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
    fontSize: 15,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    alignItems: "center",
  },
  disabled: { opacity: 0.6 },
  summaryChip: {
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 8,
  },
  summaryChipText: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  milesBox: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    alignItems: "center",
  },
  milesLabel: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  milesValue: {
    fontFamily: fonts.bold,
    color: colors.foreground,
    fontSize: 32,
    lineHeight: 40,
    marginTop: 4,
  },
  optionalToggle: {
    fontFamily: fonts.medium,
    color: colors.accent,
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 18,
  },
  optionalBlock: { marginTop: 4 },
});
