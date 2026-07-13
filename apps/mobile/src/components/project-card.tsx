import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, getStatusColor } from "../lib/theme";
import { fonts } from "../lib/fonts";
import { getEcdLabel } from "../lib/dates";
import { StatusBadge } from "./status-badge";
import type { ProjectListItem } from "../lib/admin-api";

export function ProjectCard({
  project,
  onPress,
}: {
  project: ProjectListItem;
  onPress: () => void;
}) {
  const statusColor = getStatusColor(project.status);
  const ecd = getEcdLabel(project.dueDate);
  const fielders = project.assignments
    .map((a) => `${a.fielder.firstName} ${a.fielder.lastName}`)
    .join(", ");

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.top}>
        <Text style={styles.number} numberOfLines={1}>
          {project.projectNumber}
        </Text>
        <StatusBadge label={project.status} color={statusColor} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {project.title}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {project.client.name}
      </Text>
      <Text style={styles.meta} numberOfLines={2}>
        {project.siteAddress}
        {project.city ? `, ${project.city}` : ""}
        {project.state ? ` ${project.state}` : ""}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {Number(project.sqft).toLocaleString()} SQFT
        {ecd ? ` · ECD ${ecd.text}` : ""}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {fielders || "Not assigned"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  number: {
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
