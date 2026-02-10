export type ThemeName = "green" | "coral" | "violet";

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  icon: string;
  tabIconDefault: string;
  red: string;
  yellow: string;
  darkGray: string;
  border: string;
}

export interface Theme {
  name: ThemeName;
  displayName: string;
  colors: ThemeColors;
}

const commonColors = {
  background: "#151718",
  surface: "#222",
  text: "#fff",
  textSecondary: "#888",
  icon: "#9BA1A6",
  tabIconDefault: "#9BA1A6",
  red: "#FF1744",
  yellow: "#FFD601",
  darkGray: "#424242",
  border: "#333",
};

export const themes: Record<ThemeName, Theme> = {
  green: {
    name: "green",
    displayName: "Green",
    colors: {
      ...commonColors,
      primary: "#00E676",
      primaryLight: "#00E67633",
    },
  },
  coral: {
    name: "coral",
    displayName: "Coral",
    colors: {
      ...commonColors,
      primary: "#FF6B6B",
      primaryLight: "#FF6B6B33",
    },
  },
  violet: {
    name: "violet",
    displayName: "Violet",
    colors: {
      ...commonColors,
      primary: "#B388FF",
      primaryLight: "#B388FF33",
    },
  },
};

export const defaultTheme: ThemeName = "green";
