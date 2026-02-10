import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import { useColors } from "@/contexts/ThemeContext";
import {
  ScaleGameMode,
  ScaleDifficulty,
  ScaleGameQuestion,
  ScaleGameFeedback,
} from "@/types/scale";
import ScaleGameFretboard from "./ScaleGameFretboard";

interface ScaleGamePlayCardProps {
  gameMode: ScaleGameMode;
  difficulty: ScaleDifficulty;
  question: ScaleGameQuestion;
  score: number;
  totalQuestions: number;
  feedback: ScaleGameFeedback;
  userNotes: Set<string>;
  showAnswer: boolean;
  feedbackOpacity: SharedValue<number>;
  onIdentifyAnswer: (answer: string) => void;
  onNoteTap: (string: number, fret: number) => void;
  onCheckAnswer: () => void;
}

export default function ScaleGamePlayCard({
  gameMode,
  difficulty,
  question,
  score,
  totalQuestions,
  feedback,
  userNotes,
  showAnswer,
  feedbackOpacity,
  onIdentifyAnswer,
  onNoteTap,
  onCheckAnswer,
}: ScaleGamePlayCardProps) {
  const { t } = useTranslation("common");
  const colors = useColors();

  const feedbackAnimatedStyle = useAnimatedStyle(() => ({
    opacity: feedbackOpacity.value,
  }));

  const patternDisplayName = question.patternKey.replace("_", " ");

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
            {t("scaleGame.whatScale")}
          </AppText>
          <ScaleGameFretboard pattern={question.pattern} />
          <View style={styles.options}>
            {question.options.map((option, i) => (
              <Pressable
                key={i}
                style={[
                  styles.optionBtn,
                  { backgroundColor: colors.background },
                  feedback &&
                    option === question.scaleName && {
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
                      option === question.scaleName && { color: "#fff" },
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
          <AppText style={[styles.scaleName, { color: colors.text }]}>
            {question.scaleName}
          </AppText>
          <AppText style={[styles.patternName, { color: colors.textSecondary }]}>
            {patternDisplayName}
          </AppText>
          <AppText style={[styles.question, { color: colors.textSecondary }]}>
            {t("scaleGame.playScale")}
          </AppText>
          <ScaleGameFretboard
            pattern={showAnswer ? question.pattern : null}
            userNotes={userNotes}
            interactive={!showAnswer}
            showAnswer={showAnswer}
            answerPattern={question.pattern}
            onNoteTap={onNoteTap}
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
  scaleName: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
  },
  patternName: {
    fontSize: 16,
    marginBottom: 8,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  optionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 140,
    alignItems: "center",
  },
  optionText: {
    fontSize: 13,
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
