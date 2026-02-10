import {
  SCALE_LIST,
  getPatternKeys,
  getPattern,
} from "@/assets/data/scales/SCALE_FILES_MAP";
import AppText from "@/components/AppText";
import ScaleFretboard from "@/components/ScaleFretboard";
import { useColors } from "@/contexts/ThemeContext";
import { useScaleStorage } from "@/hooks/useScaleStorage";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ScaleDetailScreen() {
  const { t } = useTranslation("common");
  const colors = useColors();
  const { scaleId } = useLocalSearchParams<{ scaleId: string }>();

  const [patternIndex, setPatternIndex] = useState(0);
  const { addRecentScale, toggleFavorite, isFavorite } = useScaleStorage();

  // 스케일 정보 가져오기
  const scaleInfo = SCALE_LIST.find((s) => s.id === scaleId);
  const patternKeys = getPatternKeys(scaleId);
  const currentPatternKey = patternKeys[patternIndex];
  const currentPattern = getPattern(scaleId, currentPatternKey);

  const displayName = scaleInfo?.name || scaleId;

  const currentScale = {
    id: scaleId,
    name: displayName,
  };
  const isCurrentFavorite = isFavorite(currentScale);

  // 조회 시 최근 검색에 추가
  useEffect(() => {
    if (scaleInfo) {
      addRecentScale(currentScale);
    }
  }, [scaleId]);

  const handlePrev = () => {
    setPatternIndex((prev) => (prev > 0 ? prev - 1 : patternKeys.length - 1));
  };

  const handleNext = () => {
    setPatternIndex((prev) => (prev < patternKeys.length - 1 ? prev + 1 : 0));
  };

  const handleToggleFavorite = () => {
    toggleFavorite(currentScale);
  };

  if (!scaleInfo || !currentPattern) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <View style={styles.errorContainer}>
          <AppText style={[styles.errorText, { color: colors.red }]}>
            {t("scales.scaleNotFound")}
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  // 패턴 이름 포맷 (Pattern_1 -> Pattern 1)
  const patternDisplayName = currentPatternKey.replace("_", " ");

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
        {/* 스케일 이름 + 즐겨찾기 */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <AppText style={[styles.scaleName, { color: colors.text }]}>
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
            {patternDisplayName} ({patternIndex + 1} / {patternKeys.length})
          </AppText>
          {currentPattern.description && (
            <AppText
              style={[styles.descriptionText, { color: colors.textSecondary }]}
            >
              {currentPattern.description}
            </AppText>
          )}
        </View>

        {/* 기타 지판 */}
        <ScaleFretboard pattern={currentPattern} />

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

        {/* 스케일 정보 */}
        <View
          style={[styles.infoContainer, { backgroundColor: colors.surface }]}
        >
          <View style={styles.infoRow}>
            <AppText
              style={[styles.infoLabel, { color: colors.textSecondary }]}
            >
              {t("scales.root")}:
            </AppText>
            <AppText style={[styles.infoValue, { color: colors.text }]}>
              {scaleInfo.root}
            </AppText>
          </View>
          <View style={styles.infoRow}>
            <AppText
              style={[styles.infoLabel, { color: colors.textSecondary }]}
            >
              Start Fret:
            </AppText>
            <AppText style={[styles.infoValue, { color: colors.text }]}>
              {currentPattern.start_fret ?? currentPattern.center_fret ?? "-"}
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
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scaleName: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
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
  descriptionText: {
    fontSize: 14,
    marginTop: 4,
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
    marginTop: 30,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
});
