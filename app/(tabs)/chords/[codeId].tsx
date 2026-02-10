import { CHORD_FILES_MAP } from "@/assets/data/chords/CHORD_FILES_MAP";
import AppText from "@/components/AppText";
import GuitarFretboard from "@/components/GuitarFretboard";
import { useColors } from "@/contexts/ThemeContext";
import { useChordStorage } from "@/hooks/useChordStorage";
import { FINGER_COLORS } from "@/types/chord";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CodeDetailScreen() {
  const { t } = useTranslation("common");
  const colors = useColors();
  const { root, suffix } = useLocalSearchParams<{
    root: string;
    suffix: string;
    codeId: string;
  }>();

  const [positionIndex, setPositionIndex] = useState(0);
  const { addRecentChord, toggleFavorite, isFavorite } = useChordStorage();

  const chordData = CHORD_FILES_MAP[root]?.[suffix];
  const positions = chordData?.positions || [];
  const currentPosition = positions[positionIndex];

  // 실제 표시용 코드 이름 (JSON의 suffix 사용)
  const displayName = chordData
    ? `${chordData.key}${chordData.suffix}`
    : `${root}${suffix}`;

  const currentChord = { root, suffix, displayName };
  const isCurrentFavorite = isFavorite(currentChord);

  // 조회 시 최근 검색에 추가
  useEffect(() => {
    if (chordData) {
      addRecentChord(currentChord);
    }
  }, [root, suffix]);

  const handlePrev = () => {
    setPositionIndex((prev) => (prev > 0 ? prev - 1 : positions.length - 1));
  };

  const handleNext = () => {
    setPositionIndex((prev) => (prev < positions.length - 1 ? prev + 1 : 0));
  };

  const handleToggleFavorite = () => {
    toggleFavorite(currentChord);
  };

  if (!chordData || !currentPosition) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <View style={styles.errorContainer}>
          <AppText style={[styles.errorText, { color: colors.red }]}>
            {t("chords.chordNotFound")}
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 코드 이름 + 즐겨찾기 */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <AppText style={[styles.chordName, { color: colors.text }]}>
              {displayName}
            </AppText>
            <Pressable
              style={styles.favoriteButton}
              onPress={handleToggleFavorite}
            >
              <AppText
                style={[
                  styles.favoriteIcon,
                  {
                    color: isCurrentFavorite
                      ? colors.yellow
                      : colors.textSecondary,
                  },
                ]}
              >
                {isCurrentFavorite ? "★" : "☆"}
              </AppText>
            </Pressable>
          </View>
          <AppText
            style={[styles.positionText, { color: colors.textSecondary }]}
          >
            {positionIndex + 1} / {positions.length}
          </AppText>
        </View>

        {/* 기타 지판 */}
        <GuitarFretboard position={currentPosition} />

        {/* 이전/다음 버튼 */}
        <View style={styles.navigation}>
          <Pressable
            style={({ pressed }) => [
              styles.navButton,
              { backgroundColor: colors.primary },
              pressed && styles.navButtonPressed,
            ]}
            onPress={handlePrev}
          >
            <AppText
              style={[styles.navButtonText, { color: colors.background }]}
            >
              {t("chords.prev")}
            </AppText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.navButton,
              { backgroundColor: colors.primary },
              pressed && styles.navButtonPressed,
            ]}
            onPress={handleNext}
          >
            <AppText
              style={[styles.navButtonText, { color: colors.background }]}
            >
              {t("chords.next")}
            </AppText>
          </Pressable>
        </View>

        {/* 코드 정보 */}
        <View
          style={[styles.infoContainer, { backgroundColor: colors.surface }]}
        >
          <View style={styles.infoRow}>
            <AppText
              style={[styles.infoLabel, { color: colors.textSecondary }]}
            >
              {t("chords.frets")}:
            </AppText>
            <AppText style={[styles.infoValue, { color: colors.text }]}>
              {currentPosition.frets}
            </AppText>
          </View>
          <View style={styles.infoRow}>
            <AppText
              style={[styles.infoLabel, { color: colors.textSecondary }]}
            >
              {t("chords.fingers")}:
            </AppText>
            <AppText style={[styles.infoValue, { color: colors.text }]}>
              {currentPosition.fingers}
            </AppText>
          </View>
          {currentPosition.barres && (
            <View style={styles.infoRow}>
              <AppText
                style={[styles.infoLabel, { color: colors.textSecondary }]}
              >
                {t("chords.barre")}:
              </AppText>
              <AppText style={[styles.infoValue, { color: colors.text }]}>
                {currentPosition.barres} {t("chords.fret")}
              </AppText>
            </View>
          )}
        </View>

        {/* 손가락 범례 */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: FINGER_COLORS[1] }]}
            />
            <AppText
              style={[styles.legendText, { color: colors.textSecondary }]}
            >
              {t("chords.finger1")}
            </AppText>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: FINGER_COLORS[2] }]}
            />
            <AppText
              style={[styles.legendText, { color: colors.textSecondary }]}
            >
              {t("chords.finger2")}
            </AppText>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: FINGER_COLORS[3] }]}
            />
            <AppText
              style={[styles.legendText, { color: colors.textSecondary }]}
            >
              {t("chords.finger3")}
            </AppText>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: FINGER_COLORS[4] }]}
            />
            <AppText
              style={[styles.legendText, { color: colors.textSecondary }]}
            >
              {t("chords.finger4")}
            </AppText>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    paddingTop: 30,
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chordName: {
    fontSize: 36,
    fontWeight: "700",
  },
  favoriteButton: {
    padding: 8,
  },
  favoriteIcon: {
    fontSize: 32,
  },
  positionText: {
    fontSize: 16,
    marginTop: 8,
  },
  errorText: {
    fontSize: 18,
    textAlign: "center",
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingHorizontal: 20,
  },
  navButton: {
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 8,
  },
  navButtonPressed: {
    opacity: 0.7,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  infoContainer: {
    borderRadius: 12,
    padding: 16,
    marginTop: 60,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    marginTop: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
  },
});
