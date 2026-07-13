import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getToken } from "../../src/lib/auth";
import { loadProjects, type ProjectListItem } from "../../src/lib/admin-api";
import { PROJECT_STATUSES } from "../../src/lib/permissions";
import { ProjectCard } from "../../src/components/project-card";
import { ProjectSearchBar } from "../../src/components/project-search-bar";
import { ChipPicker } from "../../src/components/chip-picker";
import { IconActionButton, ScreenHeader } from "../../src/components/screen-header";
import { colors } from "../../src/lib/theme";
import { fonts } from "../../src/lib/fonts";
import { screenStyles } from "../../src/lib/layout";

export default function ProjectsTabScreen() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) return router.replace("/login");
    try {
      setError("");
      setProjects(await loadProjects(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load projects");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

  const filtered = useMemo(() => {
    if (statusFilter === "all") return projects;
    return projects.filter((p) => p.status === statusFilter);
  }, [projects, statusFilter]);

  if (loading && !projects.length) {
    return (
      <View style={screenStyles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={screenStyles.container}>
      <FlatList
        data={filtered}
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
        ListHeaderComponent={
          <View>
            <ScreenHeader
              title="Projects"
              subtitle={`${filtered.length} project${filtered.length === 1 ? "" : "s"}`}
              action={
                <IconActionButton onPress={() => router.push("/projects/new")}>
                  <Ionicons name="add" size={22} color={colors.accentForeground} />
                </IconActionButton>
              }
            />
            <ProjectSearchBar placeholder="Search projects..." />
            <ChipPicker
              label="Status"
              options={["all", ...PROJECT_STATUSES]}
              value={statusFilter}
              onChange={setStatusFilter}
              formatLabel={(v) => (v === "all" ? "All" : v.replace(/_/g, " "))}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No projects match this filter.</Text>}
        renderItem={({ item }) => (
          <ProjectCard project={item} onPress={() => router.push(`/projects/${item.id}`)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: fonts.medium, color: colors.danger, marginBottom: 10, lineHeight: 18 },
  empty: {
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
    textAlign: "center",
    marginTop: 40,
    lineHeight: 20,
  },
});
