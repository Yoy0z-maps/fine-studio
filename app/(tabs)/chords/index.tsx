import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  TextInput,
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
import ChordListSection from "@/components/ChordListSection";
import ScaleListSection from "@/components/ScaleListSection";
import { GameStartCard, GamePlayCard } from "@/components/chord-game";
import { ScaleGameStartCard, ScaleGamePlayCard } from "@/components/scale-game";
import { useColors } from "@/contexts/ThemeContext";
import { useChordStorage, StoredChord } from "@/hooks/useChordStorage";
import { useScaleStorage } from "@/hooks/useScaleStorage";
import { useChordGame } from "@/hooks/useChordGame";
import { useScaleGame } from "@/hooks/useScaleGame";
import { CHORD_FILES_MAP } from "@/assets/data/chords/CHORD_FILES_MAP";
import { SCALE_LIST } from "@/assets/data/scales/SCALE_FILES_MAP";
import { ChordItem } from "@/types/chord";
import { ScaleItem, StoredScale } from "@/types/scale";

type GameType = "chord" | "scale";

export default function ChordsScreen() {
  const { t } = useTranslation("common");
  const colors = useColors();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [gameType, setGameType] = useState<GameType>("chord");

  const { recentChords, favoriteChords, reload: reloadChords } = useChordStorage();
  const { recentScales, favoriteScales, reload: reloadScales } = useScaleStorage();

  // 화면이 포커스될 때마다 데이터 다시 로드
  useFocusEffect(
    useCallback(() => {
      reloadChords();
      reloadScales();
    }, [reloadChords, reloadScales])
  );

  const chordGame = useChordGame();
  const scaleGame = useScaleGame();

  const isGameActive = gameType === "chord" ? chordGame.isGameActive : scaleGame.isGameActive;

  // 검색 결과
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.trim();
    const results: ChordItem[] = [];

    for (const root of Object.keys(CHORD_FILES_MAP)) {
      for (const suffix of Object.keys(CHORD_FILES_MAP[root])) {
        const data = CHORD_FILES_MAP[root][suffix];
        if (!data) continue;

        const displayName = `${data.key}${data.suffix || suffix}`;

        // 검색어가 코드 이름에 포함되어 있는지 확인
        if (displayName.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            root,
            suffix,
            displayName,
          });
        }
      }
    }

    return results.slice(0, 20); // 최대 20개
  }, [searchQuery]);

  const handleChordSelect = (chord: StoredChord | ChordItem) => {
    Keyboard.dismiss();
    router.push({
      pathname: "/chords/[codeId]",
      params: {
        codeId: `${chord.root}_${chord.suffix}`,
        root: chord.root,
        suffix: chord.suffix,
      },
    });
  };

  const handleScaleSelect = (scale: StoredScale | ScaleItem) => {
    Keyboard.dismiss();
    router.push({
      pathname: "/chords/scale/[scaleId]",
      params: {
        scaleId: scale.id,
      },
    });
  };

  const handleEndGame = () => {
    if (gameType === "chord") {
      chordGame.endGame();
    } else {
      scaleGame.endGame();
    }
  };

  const handleGameTypeChange = (type: GameType) => {
    // 게임 중에는 타입 변경 불가
    if (isGameActive) return;
    setGameType(type);
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
        {/* 검색바 */}
        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: colors.surface,
                color: colors.text,
              },
            ]}
            placeholder={t("chords.searchPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* 검색 결과 */}
        {searchQuery.trim() && (
          <View style={styles.section}>
            <AppText style={[styles.sectionTitle, { color: colors.text }]}>
              {t("chords.searchResults", { count: searchResults.length })}
            </AppText>
            {searchResults.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalList}
              >
                {searchResults.map((chord) => (
                  <Pressable
                    key={`${chord.root}-${chord.suffix}`}
                    style={({ pressed }) => [
                      styles.chordItem,
                      { backgroundColor: colors.surface },
                      pressed && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => handleChordSelect(chord)}
                  >
                    <AppText style={[styles.chordText, { color: colors.text }]}>
                      {chord.displayName}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View
                style={[
                  styles.emptyContainer,
                  { backgroundColor: colors.surface },
                ]}
              >
                <AppText
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  {t("chords.noResults")}
                </AppText>
                <AppText
                  style={[styles.emptyHint, { color: colors.textSecondary }]}
                >
                  {t("chords.checkCase")}
                </AppText>
              </View>
            )}
          </View>
        )}

        {/* 코드 즐겨찾기 */}
        <ChordListSection
          title={t("chords.favorites")}
          chords={favoriteChords}
          emptyText={t("chords.noFavorites")}
          emptyHint={t("chords.addFavoriteHint")}
          onChordSelect={handleChordSelect}
        />

        {/* 최근 검색 코드 */}
        <ChordListSection
          title={t("chords.recentChords")}
          chords={recentChords}
          emptyText={t("chords.noRecentChords")}
          emptyHint={t("chords.recentHint")}
          onChordSelect={handleChordSelect}
        />

        {/* 스케일 타입 목록 */}
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

        {/* 스케일 즐겨찾기 */}
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

        {/* 게임 */}
        <View style={styles.section}>
          <View style={styles.gameHeader}>
            <AppText style={[styles.sectionTitle, { color: colors.text }]}>
              {t("game.title")}
            </AppText>
            {isGameActive && (
              <Pressable onPress={handleEndGame}>
                <AppText style={[styles.closeBtn, { color: colors.primary }]}>
                  {t("game.close")}
                </AppText>
              </Pressable>
            )}
          </View>

          {/* 게임 타입 선택 (Chord / Scale) */}
          {!isGameActive && (
            <View style={styles.gameTypeRow}>
              <Pressable
                style={[
                  styles.gameTypeBtn,
                  {
                    backgroundColor:
                      gameType === "chord" ? colors.primary : colors.surface,
                  },
                ]}
                onPress={() => handleGameTypeChange("chord")}
              >
                <AppText
                  style={[
                    styles.gameTypeBtnText,
                    { color: gameType === "chord" ? "#fff" : colors.text },
                  ]}
                >
                  {t("chords.title")}
                </AppText>
              </Pressable>
              <Pressable
                style={[
                  styles.gameTypeBtn,
                  {
                    backgroundColor:
                      gameType === "scale" ? colors.primary : colors.surface,
                  },
                ]}
                onPress={() => handleGameTypeChange("scale")}
              >
                <AppText
                  style={[
                    styles.gameTypeBtnText,
                    { color: gameType === "scale" ? "#fff" : colors.text },
                  ]}
                >
                  {t("scales.title")}
                </AppText>
              </Pressable>
            </View>
          )}

          {/* Chord Game */}
          {gameType === "chord" && (
            <>
              {!chordGame.isGameActive ? (
                <GameStartCard
                  gameMode={chordGame.gameMode}
                  difficulty={chordGame.difficulty}
                  onModeChange={chordGame.setGameMode}
                  onDifficultyChange={chordGame.setDifficulty}
                  onStart={chordGame.startGame}
                />
              ) : chordGame.question ? (
                <GamePlayCard
                  gameMode={chordGame.gameMode}
                  difficulty={chordGame.difficulty}
                  question={chordGame.question}
                  score={chordGame.score}
                  totalQuestions={chordGame.totalQuestions}
                  feedback={chordGame.feedback}
                  userFrets={chordGame.userFrets}
                  showAnswer={chordGame.showAnswer}
                  feedbackOpacity={chordGame.feedbackOpacity}
                  onIdentifyAnswer={chordGame.handleIdentifyAnswer}
                  onFretTouch={chordGame.handleFretTouch}
                  onCheckAnswer={chordGame.checkPlayAnswer}
                />
              ) : null}
            </>
          )}

          {/* Scale Game */}
          {gameType === "scale" && (
            <>
              {!scaleGame.isGameActive ? (
                <ScaleGameStartCard
                  gameMode={scaleGame.gameMode}
                  difficulty={scaleGame.difficulty}
                  onModeChange={scaleGame.setGameMode}
                  onDifficultyChange={scaleGame.setDifficulty}
                  onStart={scaleGame.startGame}
                />
              ) : scaleGame.question ? (
                <ScaleGamePlayCard
                  gameMode={scaleGame.gameMode}
                  difficulty={scaleGame.difficulty}
                  question={scaleGame.question}
                  score={scaleGame.score}
                  totalQuestions={scaleGame.totalQuestions}
                  feedback={scaleGame.feedback}
                  userNotes={scaleGame.userNotes}
                  showAnswer={scaleGame.showAnswer}
                  feedbackOpacity={scaleGame.feedbackOpacity}
                  onIdentifyAnswer={scaleGame.handleIdentifyAnswer}
                  onNoteTap={scaleGame.handleNoteTap}
                  onCheckAnswer={scaleGame.checkPlayAnswer}
                />
              ) : null}
            </>
          )}
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
  searchContainer: {
    marginBottom: 24,
  },
  searchInput: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  horizontalList: {
    flexDirection: "row",
  },
  chordItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    marginRight: 10,
  },
  chordText: {
    fontSize: 14,
    fontWeight: "500",
  },
  emptyContainer: {
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
  },
  emptyHint: {
    fontSize: 12,
    marginTop: 8,
    opacity: 0.7,
    textAlign: "center",
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
  gameTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  gameTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  gameTypeBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
