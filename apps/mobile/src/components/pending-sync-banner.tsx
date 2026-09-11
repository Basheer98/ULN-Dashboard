import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { countOfflineDrafts, flushOfflineDrafts } from "../lib/offline-queue";
import { colors } from "../lib/theme";
import { fonts } from "../lib/fonts";

export function PendingSyncBanner() {
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setCount(await countOfflineDrafts());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await refresh();
        const pending = await countOfflineDrafts();
        if (pending > 0) {
          setSyncing(true);
          const result = await flushOfflineDrafts();
          setSyncing(false);
          await refresh();
          if (result.sent > 0) {
            setMessage(`Synced ${result.sent} offline item${result.sent === 1 ? "" : "s"}`);
            setTimeout(() => setMessage(null), 4000);
          }
        }
      })();
    }, [refresh])
  );

  async function syncNow() {
    setSyncing(true);
    setMessage(null);
    const result = await flushOfflineDrafts();
    setSyncing(false);
    await refresh();
    if (result.sent > 0) {
      setMessage(`Synced ${result.sent}`);
    } else if (result.failed > 0) {
      setMessage("Still offline — will retry");
    }
  }

  if (count === 0 && !message) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.textCol}>
        <Text style={styles.title}>
          {count > 0
            ? `${count} draft${count === 1 ? "" : "s"} waiting to sync`
            : message}
        </Text>
        {count > 0 ? (
          <Text style={styles.sub}>Saved on this device while signal was weak.</Text>
        ) : null}
        {message && count > 0 ? <Text style={styles.sub}>{message}</Text> : null}
      </View>
      {count > 0 ? (
        <TouchableOpacity style={styles.btn} onPress={() => void syncNow()} disabled={syncing}>
          {syncing ? (
            <ActivityIndicator color={colors.accentForeground} size="small" />
          ) : (
            <Text style={styles.btnText}>Sync</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 13, lineHeight: 18 },
  sub: { fontFamily: fonts.regular, color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 2 },
  btn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 64,
    alignItems: "center",
  },
  btnText: { fontFamily: fonts.semibold, color: colors.accentForeground, fontSize: 12 },
});
