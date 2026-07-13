import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { apiRequest } from "../lib/api";
import { getToken } from "../lib/auth";
import { colors, getStatusColor } from "../lib/theme";
import { fonts } from "../lib/fonts";
import { screenStyles } from "../lib/layout";
import { StatusBadge } from "./status-badge";

export type ProjectSearchHit = {
  id: string;
  projectNumber: string;
  title: string;
  status: string;
  clientName: string;
  siteAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  dueDate: string | null;
  fielders: string[];
  assignmentId: string | null;
};

export function ProjectSearchBar({
  placeholder = "Search projects by number, client, or address...",
}: {
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProjectSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setError("");
      return;
    }

    const timer = setTimeout(async () => {
      const token = await getToken();
      if (!token) return;
      setLoading(true);
      setError("");
      try {
        const data = await apiRequest<{ results: ProjectSearchHit[] }>(
          `/projects/search?q=${encodeURIComponent(term)}`,
          { token }
        );
        setResults(data.results);
      } catch (err) {
        setResults([]);
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const showEmpty = useMemo(
    () => !loading && query.trim().length >= 2 && results.length === 0 && !error,
    [loading, query, results.length, error]
  );

  function openResult(item: ProjectSearchHit) {
    setQuery("");
    setResults([]);
    if (item.assignmentId) {
      router.push(`/jobs/${item.assignmentId}`);
      return;
    }
    router.push(`/projects/${item.id}`);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          style={[screenStyles.input, styles.input, loading && styles.inputWithSpinner]}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {loading ? (
          <View style={styles.spinnerWrap}>
            <ActivityIndicator color={colors.accent} size="small" />
          </View>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {showEmpty ? <Text style={styles.empty}>No projects found.</Text> : null}

      {results.map((item) => {
        const statusColor = getStatusColor(item.status);
        return (
          <TouchableOpacity key={item.id} style={styles.result} onPress={() => openResult(item)} activeOpacity={0.8}>
            <View style={styles.resultTop}>
              <Text style={styles.projectNumber} numberOfLines={1}>
                {item.projectNumber}
              </Text>
              <StatusBadge label={item.status} color={statusColor} />
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.clientName}
            </Text>
            <Text style={styles.meta} numberOfLines={2}>
              {item.siteAddress}
              {item.city ? `, ${item.city}` : ""}
              {item.state ? ` ${item.state}` : ""}
            </Text>
            {item.fielders.length > 0 ? (
              <Text style={styles.meta} numberOfLines={1}>
                {item.fielders.join(", ")}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    marginBottom: 0,
  },
  inputWithSpinner: {
    paddingRight: 44,
  },
  spinnerWrap: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    fontFamily: fonts.medium,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
  },
  empty: {
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  result: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  resultTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  projectNumber: {
    fontFamily: fonts.semibold,
    color: colors.accent,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fonts.semibold,
    color: colors.foreground,
    fontSize: 15,
    lineHeight: 20,
    marginTop: 8,
  },
  meta: {
    fontFamily: fonts.regular,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
});
