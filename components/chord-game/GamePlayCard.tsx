import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import { useColors } from "@/contexts/ThemeContext";
import { GameMode, Difficulty, GameQuestion, GameFeedback } from "@/types/chord";
import GameFretboard from "./GameFretboard";

interface GamePlayCardProps {
  gameMode: GameMode;
  difficulty: Difficulty;
  question: GameQuestion;
  score: number;
  totalQuestions: number;
  feedback: GameFeedback;
  userFrets: number[];
  showAnswer: boolean;
  feedbackOpacity: SharedValue<number>;
  onIdentifyAnswer: (answer: string) => void;
  onFretTouch: (stringIndex: number, fret: number) => void;
  onCheckAnswer: () => void;
}

export default function GamePlayCard({
  gameMode,
  difficulty,
  question,
  score,
  totalQuestions,
  feedback,
  userFrets,
  showAnswer,
  feedbackOpacity,
  onIdentifyAnswer,
  onFretTouch,
  onCheckAnswer,
}: GamePlayCardProps) {
  const { t } = useTranslation("common");
  const colors = useColors();

  const feedbackAnimatedStyle = useAnimatedStyle(() => ({
    opacity: feedbackOpacity.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <AppText style={[styles.score, { color: colors.primary }]}>
          {score}/{totalQuestions}
        </AppText>
        <AppText style={[styles.difficulty, { color: colors.textSecondary }]}>
          Lv.{difficulty}
        </AppText>
      </View>

      {gameMode === "identify" ? (
        <>
          <AppText style={[styles.question, { color: colors.textSecondary }]}>
            {t("game.whatChord")}
          </AppText>
          <GameFretboard position={question.position} />
          <View style={styles.options}>
            {question.options.map((option, i) => (
              <Pressable
                key={i}
                style={[
                  styles.optionBtn,
                  { backgroundColor: colors.background },
                  feedback &&
                    option === question.chordName && {
                      backgroundColor: colors.primary,
                    },
                ]}
                onPress={() => onIdentifyAnswer(option)}
                disabled={!!feedback}
              >
                <AppText
                  style={[
                    styles.optionText,
                    { color: colors.text },
                    feedback &&
                      option === question.chordName && { color: "#fff" },
                  ]}
                >
                  {option}
                </AppText>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <AppText style={[styles.chordName, { color: colors.text }]}>
            {question.chordName}
          </AppText>
          <AppText style={[styles.question, { color: colors.textSecondary }]}>
            {t("game.playChord")}
          </AppText>
          <GameFretboard
            position={showAnswer ? question.position : null}
            userFrets={userFrets}
            interactive={!showAnswer}
            showAnswer={showAnswer}
            answerPosition={question.position}
            onFretTouch={onFretTouch}
          />
          {!feedback && (
            <Pressable
              style={[styles.checkBtn, { backgroundColor: colors.primary }]}
              onPress={onCheckAnswer}
            >
              <AppText style={styles.checkBtnText}>{t("game.check")}</AppText>
            </Pressable>
          )}
        </>
      )}

      <Animated.View style={[styles.feedback, feedbackAnimatedStyle]}>
        {feedback === "correct" && (
          <AppText style={[styles.feedbackText, { color: colors.primary }]}>
            {t("game.correct")}
          </AppText>
        )}
        {feedback === "wrong" && (
          <AppText style={[styles.feedbackText, { color: colors.red }]}>
            {t("game.wrong")}
          </AppText>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 12,
  },
  score: {
    fontSize: 18,
    fontWeight: "700",
  },
  difficulty: {
    fontSize: 14,
  },
  question: {
    fontSize: 14,
    marginBottom: 12,
  },
  chordName: {
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 4,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  optionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 70,
    alignItems: "center",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  checkBtn: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  checkBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  feedback: {
    marginTop: 12,
    height: 24,
  },
  feedbackText: {
    fontSize: 18,
    fontWeight: "700",
  },
});
