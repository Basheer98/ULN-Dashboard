import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { layout, screenStyles } from "../lib/layout";
import { colors } from "../lib/theme";
import { fonts } from "../lib/fonts";

export function ChipPicker<T extends string>({
  label,
  options,
  value,
  onChange,
  formatLabel,
}: {
  label?: string;
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  formatLabel?: (v: T) => string;
}) {
  const fmt = formatLabel ?? ((v: T) => v.replace(/_/g, " "));
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={screenStyles.chipScroll}
        contentContainerStyle={screenStyles.chipScrollContent}
      >
        {options.map((opt) => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(opt)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                {fmt(opt)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function OptionList<T extends { id: string }>({
  label,
  items,
  selectedId,
  onSelect,
  getLabel,
}: {
  label: string;
  items: T[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getLabel: (item: T) => string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView style={styles.list} nestedScrollEnabled contentContainerStyle={styles.listContent}>
        {items.map((item) => {
          const active = selectedId === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => onSelect(item.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={2}>
                {getLabel(item)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 18,
    minHeight: layout.chipHeight,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}22` },
  chipText: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textTransform: "capitalize",
  },
  chipTextActive: { color: colors.accent },
  list: { maxHeight: 180 },
  listContent: { paddingBottom: 4 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: layout.borderRadiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    justifyContent: "center",
  },
  optionActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}15` },
  optionText: {
    fontFamily: fonts.regular,
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 20,
  },
  optionTextActive: { fontFamily: fonts.semibold, color: colors.accent },
});
