import i18n from "@/app/i18n/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LANGUAGE_KEY = "app_language";
type SupportedLanguage = "en" | "ko" | "ja" | "zh";

export const languageRepo = {
  async load() {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (saved) {
      await i18n.changeLanguage(saved);
    }
  },

  async set(lng: SupportedLanguage) {
    await AsyncStorage.setItem(LANGUAGE_KEY, lng);
    await i18n.changeLanguage(lng);
  },
};
