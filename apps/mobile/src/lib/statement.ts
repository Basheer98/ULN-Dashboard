import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import { API_URL } from "./api";
import { getToken } from "./auth";

export async function downloadStatementPdf(month?: string) {
  const token = await getToken();
  if (!token) throw new Error("Not authenticated");

  const query = month ? `?month=${month}` : "";
  const url = `${API_URL}/fielders/me/statement${query}`;
  const filename = `ULN-Statement-${month ?? "current"}.pdf`;
  const dest = `${FileSystem.cacheDirectory}${filename}`;

  const result = await FileSystem.downloadAsync(url, dest, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (result.status !== 200) {
    throw new Error("Failed to download statement");
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(result.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Save Pay Statement",
      UTI: "com.adobe.pdf",
    });
  } else {
    Alert.alert("Downloaded", `Statement saved to ${result.uri}`);
  }
}
