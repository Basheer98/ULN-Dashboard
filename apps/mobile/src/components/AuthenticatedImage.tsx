import { useEffect, useState } from "react";
import { Image, View, ActivityIndicator, StyleSheet, ImageStyle, StyleProp, Text } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { API_URL } from "../lib/api";
import { getToken } from "../lib/auth";
import { colors } from "../lib/theme";

function receiptFileUrl(fileKey: string) {
  return `${API_URL}/finance/receipts/file/${fileKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function cachePathForKey(fileKey: string) {
  return `${FileSystem.cacheDirectory}receipt-${fileKey.replace(/[\\/]/g, "_")}`;
}

interface Props {
  fileKey: string;
  mimeType?: string;
  style?: StyleProp<ImageStyle>;
}

export function AuthenticatedImage({ fileKey, mimeType, style }: Props) {
  const [uri, setUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await getToken();
      if (!token || cancelled) return;

      try {
        const dest = cachePathForKey(fileKey);
        const info = await FileSystem.getInfoAsync(dest);
        if (info.exists) {
          if (!cancelled) {
            setUri(dest);
            setLoading(false);
          }
          return;
        }

        const result = await FileSystem.downloadAsync(receiptFileUrl(fileKey), dest, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!cancelled && result.status === 200) {
          setUri(result.uri);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileKey]);

  if (loading) {
    return (
      <View style={[styles.placeholder, style]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.errorText}>Unable to load</Text>
      </View>
    );
  }

  if (mimeType === "application/pdf") {
    return (
      <View style={[styles.placeholder, styles.pdfBox, style]}>
        <Text style={styles.pdfText}>PDF Receipt</Text>
      </View>
    );
  }

  return <Image source={{ uri }} style={style} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  pdfBox: { minHeight: 120 },
  pdfText: { color: colors.muted, fontSize: 13 },
  errorText: { color: colors.mutedForeground, fontSize: 12 },
});
