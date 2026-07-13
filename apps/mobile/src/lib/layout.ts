import { Platform, StyleSheet } from "react-native";
import { colors } from "./theme";
import { fonts } from "./fonts";

export const layout = {
  screenPadding: 16,
  screenPaddingBottom: 40,
  gridGap: 10,
  inputMinHeight: 48,
  buttonMinHeight: 48,
  chipHeight: 36,
  borderRadius: 12,
  borderRadiusSm: 10,
} as const;

/** Consistent vertical rhythm for body text on Android/iOS */
export const textStyles = StyleSheet.create({
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.foreground,
  },
  subheading: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 2,
  },
});

export const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: layout.screenPadding,
    paddingBottom: layout.screenPaddingBottom,
  },
  list: {
    padding: layout.screenPadding,
    paddingBottom: layout.screenPaddingBottom,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    minHeight: layout.buttonMinHeight,
    borderRadius: layout.borderRadiusSm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    fontFamily: fonts.regular,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.borderRadiusSm,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    minHeight: layout.inputMinHeight,
    color: colors.foreground,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: "center",
  },
  chipScroll: {
    flexGrow: 0,
  },
  chipScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 4,
  },
});
