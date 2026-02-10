import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeName, defaultTheme } from "@/constants/themes";

const THEME_KEY = "app_theme";

export const themeStorage = {
  async load(): Promise<ThemeName> {
    const saved = await AsyncStorage.getItem(THEME_KEY);
    if (saved === "green" || saved === "coral") {
      return saved;
    }
    return defaultTheme;
  },

  async save(theme: ThemeName): Promise<void> {
    await AsyncStorage.setItem(THEME_KEY, theme);
  },
};
