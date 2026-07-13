import { Linking, Platform, Alert } from "react-native";

export function openDirections(
  address: string,
  city?: string | null,
  state?: string | null,
  zip?: string | null
) {
  const full = [address, city, state, zip].filter(Boolean).join(", ");
  if (!full.trim()) {
    Alert.alert("No address", "This job does not have an address on file.");
    return;
  }

  const encoded = encodeURIComponent(full);
  const url =
    Platform.OS === "ios"
      ? `maps://?daddr=${encoded}`
      : Platform.OS === "android"
        ? `geo:0,0?q=${encoded}`
        : `https://maps.google.com/?q=${encoded}`;

  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://maps.google.com/?q=${encoded}`);
  });
}
