import React, { useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import ScaleListSection from "@/components/ScaleListSection";
import { ScaleGameStartCard, ScaleGamePlayCard } from "@/components/scale-game";
import { useColors } from "@/contexts/ThemeContext";
import { useScaleStorage } from "@/hooks/useScaleStorage";
import { useScaleGame } from "@/hooks/useScaleGame";
import { SCALE_LIST } from "@/assets/data/scales/SCALE_FILES_MAP";
import { ScaleItem, StoredScale } from "@/types/scale";

export default function ScalesScreen() {
  const { t } = useTranslation("common");
  const colors = useColors();
  const router = useRouter();

  const { recentScales, favoriteScales, reload } = useScaleStorage();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const game = useScaleGame();

  const handleScaleSelect = (scale: StoredScale | ScaleItem) => {
    Keyboard.dismiss();
    router.push({
      pathname: "/scales/[scaleId]",
      params: {
        scaleId: scale.id,
      },
    });
  };

  const handleEndGame = () => {
    game.endGame();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 스케일 목록 */}
        <View style={styles.section}>
          <AppText style={[styles.sectionTitle, { color: colors.text }]}>
            {t("scales.types.title")}
          </AppText>
          <View style={styles.scaleGrid}>
            {SCALE_LIST.map((scale) => (
              <Pressable
                key={scale.id}
                style={({ pressed }) => [
                  styles.scaleCard,
                  { backgroundColor: colors.surface },
                  pressed && { backgroundColor: colors.primary },
                ]}
                onPress={() => handleScaleSelect(scale)}
              >
                <AppText style={[styles.scaleText, { color: colors.text }]}>
                  {scale.name}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 즐겨찾기 */}
        <ScaleListSection
          title={t("scales.favorites")}
          scales={favoriteScales}
          emptyText={t("scales.noFavorites")}
          emptyHint={t("scales.addFavoriteHint")}
          onScaleSelect={handleScaleSelect}
        />

        {/* 최근 본 스케일 */}
        <ScaleListSection
          title={t("scales.recent")}
          scales={recentScales}
          emptyText={t("scales.noRecent")}
          emptyHint={t("scales.recentHint")}
          onScaleSelect={handleScaleSelect}
        />

        {/* 스케일 게임 */}
        <View style={styles.section}>
          <View style={styles.gameHeader}>
            <AppText style={[styles.sectionTitle, { color: colors.text }]}>
              {t("scaleGame.title")}
            </AppText>
            {game.isGameActive && (
              <Pressable onPress={handleEndGame}>
                <AppText style={[styles.closeBtn, { color: colors.primary }]}>
                  {t("game.close")}
                </AppText>
              </Pressable>
            )}
          </View>

          {!game.isGameActive ? (
            <ScaleGameStartCard
              gameMode={game.gameMode}
              difficulty={game.difficulty}
              onModeChange={game.setGameMode}
              onDifficultyChange={game.setDifficulty}
              onStart={game.startGame}
            />
          ) : game.question ? (
            <ScaleGamePlayCard
              gameMode={game.gameMode}
              difficulty={game.difficulty}
              question={game.question}
              score={game.score}
              totalQuestions={game.totalQuestions}
              feedback={game.feedback}
              userNotes={game.userNotes}
              showAnswer={game.showAnswer}
              feedbackOpacity={game.feedbackOpacity}
              onIdentifyAnswer={game.handleIdentifyAnswer}
              onNoteTap={game.handleNoteTap}
              onCheckAnswer={game.checkPlayAnswer}
            />
          ) : null}
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
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  scaleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  scaleCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: "47%",
    alignItems: "center",
  },
  scaleText: {
    fontSize: 14,
    fontWeight: "500",
  },
  gameHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  closeBtn: {
    fontSize: 14,
    fontWeight: "600",
  },
});
