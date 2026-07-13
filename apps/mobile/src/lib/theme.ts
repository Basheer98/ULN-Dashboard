/** ULN design tokens — matches packages/shared/src/theme.ts */
export const colors = {
  background: "#09090b",
  foreground: "#fafafa",
  muted: "#a1a1aa",
  mutedForeground: "#71717a",
  surface: "#111113",
  surfaceElevated: "#1c1c1f",
  surfaceHover: "#232326",
  border: "#27272a",
  borderSubtle: "#1f1f23",
  accent: "#2dd4bf",
  accentHover: "#14b8a6",
  accentForeground: "#042f2e",
  danger: "#f87171",
  success: "#34d399",
  warning: "#fbbf24",
  info: "#60a5fa",
} as const;

export function getStatusColor(status: string): string {
  switch (status) {
    case "complete":
    case "paid":
    case "reimbursed":
    case "approved":
      return colors.success;
    case "in_progress":
    case "submitted":
    case "pending":
    case "pending_review":
      return colors.warning;
    case "assigned":
    case "sent":
      return colors.info;
    case "rejected":
    case "overdue":
      return colors.danger;
    default:
      return colors.muted;
  }
}
