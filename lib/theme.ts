export const themeColors = {
  light: {
    background: "#FFFFFF",
    surface: "#F8FAFC",
    surfaceAlt: "#F1F5F9",
    accent: "#2563EB",
    accentHover: "#3B82F6",
    text: "#0F172A",
    textMuted: "#64748B",
    border: "#E2E8F0",
  },
  dark: {
    background: "#0F172A",
    surface: "#1E293B",
    surfaceAlt: "#334155",
    accent: "#60A5FA",
    accentHover: "#93C5FD",
    text: "#F8FAFC",
    textMuted: "#94A3B8",
    border: "#334155",
  },
} as const;

export type ThemeMode = keyof typeof themeColors;

export const STORAGE_THEME_KEY = "tally-portal-theme";
