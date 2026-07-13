import { TextStyle } from "react-native";
import { fonts } from "./fonts";
import { colors } from "./theme";

export const text = {
  regular: { fontFamily: fonts.regular } as TextStyle,
  medium: { fontFamily: fonts.medium } as TextStyle,
  semibold: { fontFamily: fonts.semibold } as TextStyle,
  bold: { fontFamily: fonts.bold } as TextStyle,
  h1: { fontFamily: fonts.bold, fontSize: 22, color: colors.foreground } as TextStyle,
  h2: { fontFamily: fonts.semibold, fontSize: 17, color: colors.foreground } as TextStyle,
  body: { fontFamily: fonts.regular, fontSize: 15, color: colors.foreground } as TextStyle,
  caption: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedForeground } as TextStyle,
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.mutedForeground,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  } as TextStyle,
};

export function formatStatusLabel(status: string): string {
  const normalized = status.replace(/_/g, " ").toLowerCase();
  if (normalized === "not generated") return "Pending";
  return normalized.replace(/\b\w/g, (c) => c.toUpperCase());
}
