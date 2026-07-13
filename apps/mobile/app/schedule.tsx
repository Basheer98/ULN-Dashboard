import { useCallback, useMemo, useState } from "react";
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
import { getToken } from "../src/lib/auth";
import { loadSchedule, type ProjectListItem } from "../src/lib/admin-api";
import { ProjectCard } from "../src/components/project-card";
import { colors } from "../src/lib/theme";
import { fonts } from "../src/lib/fonts";

export default function ScheduleScreen() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return router.replace("/login");
    try {
      setProjects(await loadSchedule(token));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

  const grouped = useMemo(() => {
    const map = new Map<string, ProjectListItem[]>();
    for (const p of projects) {
      const key = p.dueDate ? p.dueDate.slice(0, 10) : "No ECD";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [projects]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={grouped}
      keyExtractor={([date]) => date}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={() => { setRefreshing(true); load(); }} />
      }
      ListHeaderComponent={
        <View>
          <Text style={styles.heading}>Schedule</Text>
          <Text style={styles.subheading}>Projects by ECD (next 30 days)</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No scheduled projects in range.</Text>}
      renderItem={({ item: [date, items] }) => (
        <View style={styles.group}>
          <Text style={styles.dateLabel}>{date}</Text>
          {items.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onPress={() => router.push(`/projects/${project.id}`)}
            />
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  heading: { fontFamily: fonts.bold, color: colors.foreground, fontSize: 24 },
  subheading: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14, marginTop: 4, marginBottom: 16 },
  group: { marginBottom: 16 },
  dateLabel: { fontFamily: fonts.semibold, color: colors.accent, fontSize: 14, marginBottom: 8 },
  empty: { fontFamily: fonts.regular, color: colors.mutedForeground, textAlign: "center", marginTop: 40 },
});
