import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  MetronomeSettings,
  FavoriteTempo,
  DEFAULT_SETTINGS,
} from "@/utils/metronome/types";

const SETTINGS_KEY = "metronome_settings";
const FAVORITES_KEY = "metronome_favorites";

interface UseMetronomeStorageReturn {
  settings: MetronomeSettings;
  favorites: FavoriteTempo[];
  isLoading: boolean;
  saveSettings: (settings: Partial<MetronomeSettings>) => Promise<void>;
  addFavorite: (tempo: number, label?: string) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  isFavoriteTempo: (tempo: number) => boolean;
  toggleFavoriteTempo: (tempo: number) => Promise<void>;
}

export function useMetronomeStorage(): UseMetronomeStorageReturn {
  const [settings, setSettings] = useState<MetronomeSettings>(DEFAULT_SETTINGS);
  const [favorites, setFavorites] = useState<FavoriteTempo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored data on mount
  useEffect(() => {
    loadStorage();
  }, []);

  const loadStorage = async () => {
    try {
      const [settingsJson, favoritesJson] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_KEY),
        AsyncStorage.getItem(FAVORITES_KEY),
      ]);

      if (settingsJson) {
        const parsed = JSON.parse(settingsJson);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }

      if (favoritesJson) {
        setFavorites(JSON.parse(favoritesJson));
      }
    } catch (error) {
      console.error("Failed to load metronome storage:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = useCallback(
    async (newSettings: Partial<MetronomeSettings>) => {
      try {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save settings:", error);
      }
    },
    [settings]
  );

  const addFavorite = useCallback(
    async (tempo: number, label?: string) => {
      try {
        // Check if already exists
        if (favorites.some((f) => f.tempo === tempo)) {
          return;
        }

        const newFavorite: FavoriteTempo = {
          id: `${Date.now()}-${tempo}`,
          tempo,
          label,
        };

        const updated = [...favorites, newFavorite].sort(
          (a, b) => a.tempo - b.tempo
        );
        setFavorites(updated);
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to add favorite:", error);
      }
    },
    [favorites]
  );

  const removeFavorite = useCallback(
    async (id: string) => {
      try {
        const updated = favorites.filter((f) => f.id !== id);
        setFavorites(updated);
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to remove favorite:", error);
      }
    },
    [favorites]
  );

  const isFavoriteTempo = useCallback(
    (tempo: number) => {
      return favorites.some((f) => f.tempo === tempo);
    },
    [favorites]
  );

  const toggleFavoriteTempo = useCallback(
    async (tempo: number) => {
      const existing = favorites.find((f) => f.tempo === tempo);
      if (existing) {
        await removeFavorite(existing.id);
      } else {
        await addFavorite(tempo);
      }
    },
    [favorites, addFavorite, removeFavorite]
  );

  return {
    settings,
    favorites,
    isLoading,
    saveSettings,
    addFavorite,
    removeFavorite,
    isFavoriteTempo,
    toggleFavoriteTempo,
  };
}
