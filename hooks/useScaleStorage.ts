import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { StoredScale } from "@/types/scale";

const RECENT_SCALES_KEY = "recent_scales";
const FAVORITE_SCALES_KEY = "favorite_scales";
const MAX_RECENT_SCALES = 20;

export type { StoredScale } from "@/types/scale";

export function useScaleStorage() {
  const [recentScales, setRecentScales] = useState<StoredScale[]>([]);
  const [favoriteScales, setFavoriteScales] = useState<StoredScale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStorage();
  }, []);

  const loadStorage = async () => {
    try {
      const [recentJson, favoriteJson] = await Promise.all([
        AsyncStorage.getItem(RECENT_SCALES_KEY),
        AsyncStorage.getItem(FAVORITE_SCALES_KEY),
      ]);

      if (recentJson) {
        setRecentScales(JSON.parse(recentJson));
      }
      if (favoriteJson) {
        setFavoriteScales(JSON.parse(favoriteJson));
      }
    } catch (error) {
      console.error("Failed to load scale storage:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addRecentScale = useCallback(async (scale: StoredScale) => {
    try {
      setRecentScales((prev) => {
        const filtered = prev.filter((s) => s.id !== scale.id);
        const updated = [scale, ...filtered].slice(0, MAX_RECENT_SCALES);
        AsyncStorage.setItem(RECENT_SCALES_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error("Failed to add recent scale:", error);
    }
  }, []);

  const toggleFavorite = useCallback(async (scale: StoredScale) => {
    try {
      setFavoriteScales((prev) => {
        const exists = prev.some((s) => s.id === scale.id);

        let updated: StoredScale[];
        if (exists) {
          updated = prev.filter((s) => s.id !== scale.id);
        } else {
          updated = [scale, ...prev];
        }

        AsyncStorage.setItem(FAVORITE_SCALES_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  }, []);

  const isFavorite = useCallback(
    (scale: StoredScale) => {
      return favoriteScales.some((s) => s.id === scale.id);
    },
    [favoriteScales]
  );

  return {
    recentScales,
    favoriteScales,
    isLoading,
    addRecentScale,
    toggleFavorite,
    isFavorite,
    reload: loadStorage,
  };
}
