import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getToken, getUser } from "../../src/lib/auth";
import {
  loadOfficeNotifications,
  updateNotification,
  type OfficeNotification,
} from "../../src/lib/office";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";
import { screenStyles } from "../../src/lib/layout";

export default function InboxScreen() {
  const [items, setItems] = useState<OfficeNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  const [isFielder, setIsFielder] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return router.replace("/login");
    try {
      const user = await getUser();
      setIsFielder(user?.role === "fielder");
      const data = await loadOfficeNotifications(token);
      setItems(data.notifications);
      setUnread(data.unreadCount);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

  async function open(item: OfficeNotification) {
    const token = await getToken();
    if (token && item.isUnread) {
      await updateNotification(token, item.id, "read");
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, isUnread: false, readAt: new Date().toISOString() } : entry
        )
      );
      setUnread((count) => Math.max(0, count - 1));
    }

    if (
      item.type.startsWith("payment") ||
      item.entityType === "payment"
    ) {
      router.push("/earnings");
      return;
    }
    if (item.type.startsWith("expense") || item.entityType === "expense") {
      if (isFielder) {
        router.push("/(tabs)/expenses");
      } else {
        router.push("/(tabs)/approvals");
      }
      return;
    }
    if (item.type.startsWith("mileage") || item.entityType === "mileage") {
      if (isFielder) {
        router.push("/mileage");
      } else {
        router.push("/(tabs)/approvals");
      }
      return;
    }
    if (item.entityType === "project" && item.entityId) {
      router.push(`/projects/${item.entityId}`);
      return;
    }
    if (item.type.includes("job") || item.type.includes("project")) {
      router.push(isFielder ? "/(tabs)/jobs" : "/(tabs)/projects");
      return;
    }
    router.push(isFielder ? "/(tabs)/jobs" : "/(tabs)/monitor");
  }

  async function resolve(item: OfficeNotification) {
    const token = await getToken();
    if (!token) return;
    await updateNotification(token, item.id, "resolve");
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    if (item.isUnread) setUnread((count) => Math.max(0, count - 1));
  }

  if (loading) {
    return (
      <View style={screenStyles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={screenStyles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{isFielder ? "Notifications" : "Activity inbox"}</Text>
          <Text style={styles.subtitle}>
            {unread} unread{isFielder ? " · payments & expenses" : " notification" + (unread === 1 ? "" : "s")}
          </Text>
        </View>
      </View>
      <FlatList
        data={items.filter((item) => item.isOpen)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={screenStyles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isFielder
              ? "No payment or expense updates yet."
              : "You’re all caught up."}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, item.isUnread && styles.unreadCard]} onPress={() => open(item)}>
            <View style={styles.cardTop}>
              <View style={styles.titleRow}>
                {item.isUnread ? <View style={styles.dot} /> : null}
                <Text style={styles.cardTitle}>{item.title}</Text>
              </View>
              <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
            </View>
            <Text style={styles.body}>{item.body}</Text>
            <TouchableOpacity style={styles.resolveButton} onPress={() => resolve(item)}>
              <Text style={styles.resolveText}>{isFielder ? "Dismiss" : "Resolve"}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

const styles = StyleSheet.create({
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 22, lineHeight: 28 },
  subtitle: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  unreadCard: { borderColor: colors.accent, backgroundColor: colors.surfaceElevated },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0, gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent, flexShrink: 0 },
  cardTitle: { fontFamily: fonts.semibold, color: colors.foreground, fontSize: 15, lineHeight: 20, flex: 1 },
  time: { fontFamily: fonts.medium, color: colors.mutedForeground, fontSize: 11, lineHeight: 14, flexShrink: 0 },
  body: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 7 },
  resolveButton: {
    alignSelf: "flex-start",
    marginTop: 12,
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  resolveText: { fontFamily: fonts.semibold, color: colors.muted, fontSize: 11, lineHeight: 14 },
  empty: { fontFamily: fonts.regular, color: colors.mutedForeground, textAlign: "center", marginTop: 60, lineHeight: 20 },
});
