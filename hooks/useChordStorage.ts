import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { StoredChord } from "@/types/chord";

const RECENT_CHORDS_KEY = "recent_chords";
const FAVORITE_CHORDS_KEY = "favorite_chords";
const MAX_RECENT_CHORDS = 20;

// Re-export for backwards compatibility
export type { StoredChord } from "@/types/chord";

export function useChordStorage() {
  const [recentChords, setRecentChords] = useState<StoredChord[]>([]);
  const [favoriteChords, setFavoriteChords] = useState<StoredChord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 초기 로드
  useEffect(() => {
    loadStorage();
  }, []);

  const loadStorage = async () => {
    try {
      const [recentJson, favoriteJson] = await Promise.all([
        AsyncStorage.getItem(RECENT_CHORDS_KEY),
        AsyncStorage.getItem(FAVORITE_CHORDS_KEY),
      ]);

      if (recentJson) {
        setRecentChords(JSON.parse(recentJson));
      }
      if (favoriteJson) {
        setFavoriteChords(JSON.parse(favoriteJson));
      }
    } catch (error) {
      console.error("Failed to load chord storage:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 최근 검색에 추가
  const addRecentChord = useCallback(async (chord: StoredChord) => {
    try {
      setRecentChords((prev) => {
        // 이미 있으면 제거 후 맨 앞에 추가
        const filtered = prev.filter(
          (c) => !(c.root === chord.root && c.suffix === chord.suffix)
        );
        const updated = [chord, ...filtered].slice(0, MAX_RECENT_CHORDS);

        // 비동기로 저장
        AsyncStorage.setItem(RECENT_CHORDS_KEY, JSON.stringify(updated));

        return updated;
      });
    } catch (error) {
      console.error("Failed to add recent chord:", error);
    }
  }, []);

  // 즐겨찾기 토글
  const toggleFavorite = useCallback(async (chord: StoredChord) => {
    try {
      setFavoriteChords((prev) => {
        const exists = prev.some(
          (c) => c.root === chord.root && c.suffix === chord.suffix
        );

        let updated: StoredChord[];
        if (exists) {
          updated = prev.filter(
            (c) => !(c.root === chord.root && c.suffix === chord.suffix)
          );
        } else {
          updated = [chord, ...prev];
        }

        // 비동기로 저장
        AsyncStorage.setItem(FAVORITE_CHORDS_KEY, JSON.stringify(updated));

        return updated;
      });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  }, []);

  // 즐겨찾기 여부 확인
  const isFavorite = useCallback(
    (chord: StoredChord) => {
      return favoriteChords.some(
        (c) => c.root === chord.root && c.suffix === chord.suffix
      );
    },
    [favoriteChords]
  );

  return {
    recentChords,
    favoriteChords,
    isLoading,
    addRecentChord,
    toggleFavorite,
    isFavorite,
    reload: loadStorage,
  };
}
