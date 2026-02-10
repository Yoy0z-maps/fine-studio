import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import { useColors } from "@/contexts/ThemeContext";
import { GameMode, Difficulty } from "@/types/chord";

interface GameStartCardProps {
  gameMode: GameMode;
  difficulty: Difficulty;
  onModeChange: (mode: GameMode) => void;
  onDifficultyChange: (level: Difficulty) => void;
  onStart: () => void;
}

export default function GameStartCard({
  gameMode,
  difficulty,
  onModeChange,
  onDifficultyChange,
  onStart,
}: GameStartCardProps) {
  const { t } = useTranslation("common");
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* 모드 선택 */}
      <View style={styles.modeRow}>
        <Pressable
          style={[
            styles.modeBtn,
            {
              backgroundColor:
                gameMode === "identify" ? colors.primary : colors.background,
            },
          ]}
          onPress={() => onModeChange("identify")}
        >
          <AppText
            style={[
              styles.modeBtnText,
              { color: gameMode === "identify" ? "#fff" : colors.text },
            ]}
          >
            {t("game.identifyMode")}
          </AppText>
        </Pressable>
        <Pressable
          style={[
            styles.modeBtn,
            {
              backgroundColor:
                gameMode === "play" ? colors.primary : colors.background,
            },
          ]}
          onPress={() => onModeChange("play")}
        >
          <AppText
            style={[
              styles.modeBtnText,
              { color: gameMode === "play" ? "#fff" : colors.text },
            ]}
          >
            {t("game.playMode")}
          </AppText>
        </Pressable>
      </View>

      <AppText style={[styles.description, { color: colors.textSecondary }]}>
        {gameMode === "identify" ? t("game.identifyDesc") : t("game.playDesc")}
      </AppText>

      {/* 난이도 선택 */}
      <View style={styles.difficultyRow}>
        {([1, 2, 3, 4, 5] as Difficulty[]).map((level) => (
          <Pressable
            key={level}
            style={[
              styles.difficultyBtn,
              {
                backgroundColor:
                  difficulty === level ? colors.primary : colors.background,
              },
            ]}
            onPress={() => onDifficultyChange(level)}
          >
            <AppText
              style={[
                styles.difficultyText,
                { color: difficulty === level ? "#fff" : colors.text },
              ]}
            >
              Lv.{level}
            </AppText>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.startBtn, { backgroundColor: colors.primary }]}
        onPress={onStart}
      >
        <AppText style={styles.startBtnText}>{t("game.start")}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  modeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  difficultyRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  difficultyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  difficultyText: {
    fontSize: 14,
    fontWeight: "600",
  },
  startBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
