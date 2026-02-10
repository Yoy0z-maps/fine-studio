import {
  Theme,
  ThemeColors,
  ThemeName,
  defaultTheme,
  themes,
} from "@/constants/themes";
import { themeStorage } from "@/utils/themeStorage";
import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

interface ThemeContextValue {
  themeName: ThemeName;
  theme: Theme;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface AppThemeProviderProps {
  children: ReactNode;
  initialTheme?: ThemeName;
}

export function AppThemeProvider({
  children,
  initialTheme,
}: AppThemeProviderProps) {
  const [themeName, setThemeName] = useState<ThemeName>(
    initialTheme ?? defaultTheme,
  );

  const setTheme = useCallback((name: ThemeName) => {
    setThemeName(name);
    themeStorage.save(name);
  }, []);

  const value: ThemeContextValue = {
    themeName,
    theme: themes[themeName],
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within an AppThemeProvider");
  }
  return context;
}

export function useColors(): ThemeColors {
  const { theme } = useTheme();
  return theme.colors;
}
