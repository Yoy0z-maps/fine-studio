import { useState, useCallback } from "react";
import { useSharedValue, withTiming, SharedValue } from "react-native-reanimated";
import {
  SCALE_LIST,
  getPatternKeys,
  getPattern,
} from "@/assets/data/scales/SCALE_FILES_MAP";
import {
  ScalePattern,
  ScaleGameMode,
  ScaleDifficulty,
  ScaleGameQuestion,
  ScaleDifficultyConfig,
  ScaleGameFeedback,
} from "@/types/scale";

// 난이도별 설정 (4개 스케일만 사용)
const DIFFICULTY_CONFIG: Record<ScaleDifficulty, ScaleDifficultyConfig> = {
  1: {
    scales: ["c_pentatonic"],
  },
  2: {
    scales: ["c_pentatonic", "a_blues"],
  },
  3: {
    scales: ["c_pentatonic", "a_blues", "c_major"],
  },
  4: {
    scales: ["c_pentatonic", "a_blues", "c_major", "a_minor"],
  },
  5: {
    scales: ["c_pentatonic", "a_blues", "c_major", "a_minor"],
  },
};

// ScaleGameFretboard's interactive touch grid can't adapt to the hidden
// answer's fret range without leaking it, so when the pattern is hidden it
// always falls back to a fixed window covering open + frets 1-7.
const INTERACTIVE_MAX_FRET = 7;

function isPlayableInteractively(pattern: ScalePattern): boolean {
  return pattern.positions.every((pos) =>
    pos.frets.every((fret) => fret <= INTERACTIVE_MAX_FRET)
  );
}

function getRandomQuestion(
  difficulty: ScaleDifficulty,
  gameMode: ScaleGameMode
): ScaleGameQuestion | null {
  const config = DIFFICULTY_CONFIG[difficulty];

  // 랜덤 스케일 선택
  const scaleId = config.scales[Math.floor(Math.random() * config.scales.length)];
  const scaleInfo = SCALE_LIST.find((s) => s.id === scaleId);
  if (!scaleInfo) return null;

  // 랜덤 패턴 선택 - "Play" 모드는 고정된 1-7프렛 그리드로만 입력할 수 있으므로
  // 그 안에 들어오는 패턴만 사용한다. "Identify" 모드는 표시만 하면 되므로
  // (ScaleGameFretboard가 어떤 범위든 맞춰 그린다) 모든 패턴을 사용할 수 있다.
  let patternKeys = getPatternKeys(scaleId);
  if (gameMode === "play") {
    patternKeys = patternKeys.filter((key) => {
      const pattern = getPattern(scaleId, key);
      return pattern != null && isPlayableInteractively(pattern);
    });
  }
  if (patternKeys.length === 0) return null;

  const patternKey = patternKeys[Math.floor(Math.random() * patternKeys.length)];
  const pattern = getPattern(scaleId, patternKey);
  if (!pattern) return null;

  // 오답 선택지 생성
  const otherOptions: string[] = [];
  const otherScales = SCALE_LIST.filter((s) => s.id !== scaleId);

  for (const otherScale of otherScales) {
    otherOptions.push(otherScale.name);
  }

  return {
    scaleId,
    scaleName: scaleInfo.name,
    patternKey,
    pattern,
    options: [scaleInfo.name, ...otherOptions.slice(0, 3)].sort(() => Math.random() - 0.5),
  };
}

export interface UseScaleGameReturn {
  gameMode: ScaleGameMode;
  isGameActive: boolean;
  difficulty: ScaleDifficulty;
  question: ScaleGameQuestion | null;
  score: number;
  totalQuestions: number;
  feedback: ScaleGameFeedback;
  userNotes: Set<string>;
  showAnswer: boolean;
  feedbackOpacity: SharedValue<number>;

  setGameMode: (mode: ScaleGameMode) => void;
  setDifficulty: (level: ScaleDifficulty) => void;
  startGame: () => void;
  endGame: () => void;
  handleIdentifyAnswer: (answer: string) => void;
  handleNoteTap: (string: number, fret: number) => void;
  checkPlayAnswer: () => void;
}

export function useScaleGame(): UseScaleGameReturn {
  const [gameMode, setGameMode] = useState<ScaleGameMode>("identify");
  const [isGameActive, setIsGameActive] = useState(false);
  const [difficulty, setDifficulty] = useState<ScaleDifficulty>(1);
  const [question, setQuestion] = useState<ScaleGameQuestion | null>(null);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [feedback, setFeedback] = useState<ScaleGameFeedback>(null);
  const [userNotes, setUserNotes] = useState<Set<string>>(new Set());
  const [showAnswer, setShowAnswer] = useState(false);

  const feedbackOpacity = useSharedValue(0);

  const nextQuestion = useCallback(() => {
    const newQuestion = getRandomQuestion(difficulty, gameMode);
    setQuestion(newQuestion);
    setFeedback(null);
    setShowAnswer(false);
    setUserNotes(new Set());
  }, [difficulty, gameMode]);

  const startGame = useCallback(() => {
    setIsGameActive(true);
    setScore(0);
    setTotalQuestions(0);
    setFeedback(null);
    setShowAnswer(false);
    setUserNotes(new Set());
    const newQuestion = getRandomQuestion(difficulty, gameMode);
    setQuestion(newQuestion);
  }, [difficulty, gameMode]);

  const endGame = useCallback(() => {
    setIsGameActive(false);
  }, []);

  const handleIdentifyAnswer = useCallback(
    (answer: string) => {
      if (!question || feedback) return;
      const isCorrect = answer === question.scaleName;
      setFeedback(isCorrect ? "correct" : "wrong");
      setTotalQuestions((prev) => prev + 1);
      if (isCorrect) setScore((prev) => prev + 1);

      feedbackOpacity.value = withTiming(1, { duration: 200 });
      setTimeout(() => {
        feedbackOpacity.value = withTiming(0, { duration: 200 });
        nextQuestion();
      }, 1200);
    },
    [question, feedback, nextQuestion, feedbackOpacity]
  );

  const handleNoteTap = useCallback(
    (string: number, fret: number) => {
      if (gameMode !== "play" || !question || feedback) return;
      const noteKey = `${string}-${fret}`;
      setUserNotes((prev) => {
        const newNotes = new Set(prev);
        if (newNotes.has(noteKey)) {
          newNotes.delete(noteKey);
        } else {
          newNotes.add(noteKey);
        }
        return newNotes;
      });
    },
    [gameMode, question, feedback]
  );

  const checkPlayAnswer = useCallback(() => {
    if (!question || feedback) return;

    // 정답 노트 세트 생성
    const correctNotes = new Set<string>();
    for (const stringPos of question.pattern.positions) {
      for (const fret of stringPos.frets) {
        correctNotes.add(`${stringPos.string}-${fret}`);
      }
    }

    // 정답 확인
    const isCorrect =
      userNotes.size === correctNotes.size &&
      Array.from(userNotes).every((note) => correctNotes.has(note));

    setFeedback(isCorrect ? "correct" : "wrong");
    setTotalQuestions((prev) => prev + 1);
    if (isCorrect) {
      setScore((prev) => prev + 1);
    } else {
      setShowAnswer(true);
    }

    feedbackOpacity.value = withTiming(1, { duration: 200 });
    setTimeout(() => {
      feedbackOpacity.value = withTiming(0, { duration: 200 });
      nextQuestion();
    }, 2000);
  }, [question, userNotes, feedback, nextQuestion, feedbackOpacity]);

  return {
    gameMode,
    isGameActive,
    difficulty,
    question,
    score,
    totalQuestions,
    feedback,
    userNotes,
    showAnswer,
    feedbackOpacity,
    setGameMode,
    setDifficulty,
    startGame,
    endGame,
    handleIdentifyAnswer,
    handleNoteTap,
    checkPlayAnswer,
  };
}
