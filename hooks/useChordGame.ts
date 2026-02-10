import { useState, useCallback } from "react";
import { useSharedValue, withTiming, SharedValue } from "react-native-reanimated";
import { CHORD_FILES_MAP } from "@/assets/data/chords/CHORD_FILES_MAP";
import {
  parseBarres,
  parseFingers,
  parseFrets,
} from "@/utils/chords/parseFrets";
import {
  ChordPosition,
  GameMode,
  Difficulty,
  GameQuestion,
  DifficultyConfig,
  GameFeedback,
} from "@/types/chord";

// 난이도별 설정
const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  1: {
    chords: ["major", "minor"],
    roots: ["C", "D", "E", "G", "A"],
    maxFret: 3,
  },
  2: {
    chords: ["major", "minor", "7"],
    roots: ["C", "D", "E", "G", "A", "B"],
    maxFret: 4,
  },
  3: {
    chords: ["major", "minor", "7", "maj7", "m7"],
    roots: ["C", "D", "E", "F", "G", "A", "B"],
    maxFret: 5,
  },
  4: {
    chords: ["major", "minor", "7", "maj7", "m7", "dim", "aug"],
    roots: ["C", "D", "E", "F", "G", "A", "B", "C#", "F#"],
    maxFret: 7,
  },
  5: {
    chords: [
      "major",
      "minor",
      "7",
      "maj7",
      "m7",
      "dim",
      "aug",
      "sus2",
      "sus4",
      "add9",
      "9",
    ],
    roots: ["C", "D", "E", "F", "G", "A", "B", "C#", "Eb", "F#", "Ab", "Bb"],
    maxFret: 12,
  },
};

function getRandomChord(difficulty: Difficulty): GameQuestion | null {
  const config = DIFFICULTY_CONFIG[difficulty];
  const availableChords: {
    root: string;
    suffix: string;
    displayName: string;
    position: ChordPosition;
    allPositions: ChordPosition[];
  }[] = [];

  for (const root of Object.keys(CHORD_FILES_MAP)) {
    if (!config.roots.includes(root)) continue;

    for (const suffix of Object.keys(CHORD_FILES_MAP[root])) {
      const data = CHORD_FILES_MAP[root][suffix];
      if (!data?.positions?.length) continue;

      const normalizedSuffix = suffix.toLowerCase().replace(/\s/g, "");
      const matchesDifficulty = config.chords.some((c) => {
        const normalized = c.toLowerCase().replace(/\s/g, "");
        return (
          normalizedSuffix === normalized ||
          normalizedSuffix.startsWith(normalized)
        );
      });
      if (!matchesDifficulty) continue;

      const rawPosition = data.positions[0];
      const frets = parseFrets(rawPosition.frets);
      const maxFret = Math.max(...frets.filter((f: number) => f > 0));
      if (maxFret > config.maxFret) continue;

      const allPositions: ChordPosition[] = data.positions.map((p: any) => ({
        frets: parseFrets(p.frets),
        fingers: parseFingers(p.fingers),
        barres: parseBarres(p.barres),
        baseFret: p.baseFret || 1,
      }));

      availableChords.push({
        root,
        suffix,
        displayName: `${root}${data.suffix || suffix}`,
        position: {
          frets,
          fingers: parseFingers(rawPosition.fingers),
          barres: parseBarres(rawPosition.barres),
          baseFret: rawPosition.baseFret || 1,
        },
        allPositions,
      });
    }
  }

  if (availableChords.length === 0) return null;

  const selected =
    availableChords[Math.floor(Math.random() * availableChords.length)];
  const otherChords = availableChords
    .filter((c) => c.displayName !== selected.displayName)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((c) => c.displayName);

  return {
    chordName: selected.displayName,
    root: selected.root,
    suffix: selected.suffix,
    position: selected.position,
    allPositions: selected.allPositions,
    options: [selected.displayName, ...otherChords].sort(
      () => Math.random() - 0.5
    ),
  };
}

export interface UseChordGameReturn {
  // State
  gameMode: GameMode;
  isGameActive: boolean;
  difficulty: Difficulty;
  question: GameQuestion | null;
  score: number;
  totalQuestions: number;
  feedback: GameFeedback;
  userFrets: number[];
  showAnswer: boolean;
  feedbackOpacity: SharedValue<number>;

  // Actions
  setGameMode: (mode: GameMode) => void;
  setDifficulty: (level: Difficulty) => void;
  startGame: () => void;
  endGame: () => void;
  handleIdentifyAnswer: (answer: string) => void;
  handleFretTouch: (stringIndex: number, fret: number) => void;
  checkPlayAnswer: () => void;
}

export function useChordGame(): UseChordGameReturn {
  const [gameMode, setGameMode] = useState<GameMode>("identify");
  const [isGameActive, setIsGameActive] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>(1);
  const [question, setQuestion] = useState<GameQuestion | null>(null);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [feedback, setFeedback] = useState<GameFeedback>(null);
  const [userFrets, setUserFrets] = useState<number[]>([-1, -1, -1, -1, -1, -1]);
  const [showAnswer, setShowAnswer] = useState(false);

  const feedbackOpacity = useSharedValue(0);

  const nextQuestion = useCallback(() => {
    const newQuestion = getRandomChord(difficulty);
    setQuestion(newQuestion);
    setFeedback(null);
    setShowAnswer(false);
    setUserFrets([-1, -1, -1, -1, -1, -1]);
  }, [difficulty]);

  const startGame = useCallback(() => {
    setIsGameActive(true);
    setScore(0);
    setTotalQuestions(0);
    setFeedback(null);
    setShowAnswer(false);
    setUserFrets([-1, -1, -1, -1, -1, -1]);
    const newQuestion = getRandomChord(difficulty);
    setQuestion(newQuestion);
  }, [difficulty]);

  const endGame = useCallback(() => {
    setIsGameActive(false);
  }, []);

  const handleIdentifyAnswer = useCallback(
    (answer: string) => {
      if (!question || feedback) return;
      const isCorrect = answer === question.chordName;
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

  const handleFretTouch = useCallback(
    (stringIndex: number, fret: number) => {
      if (gameMode !== "play" || !question || feedback) return;
      setUserFrets((prev) => {
        const newFrets = [...prev];
        newFrets[stringIndex] = newFrets[stringIndex] === fret ? -1 : fret;
        return newFrets;
      });
    },
    [gameMode, question, feedback]
  );

  const checkPlayAnswer = useCallback(() => {
    if (!question || feedback) return;

    const isCorrect = question.allPositions.some((pos) => {
      return pos.frets.every((fret, i) => userFrets[i] === fret);
    });

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
  }, [question, userFrets, feedback, nextQuestion, feedbackOpacity]);

  return {
    gameMode,
    isGameActive,
    difficulty,
    question,
    score,
    totalQuestions,
    feedback,
    userFrets,
    showAnswer,
    feedbackOpacity,
    setGameMode,
    setDifficulty,
    startGame,
    endGame,
    handleIdentifyAnswer,
    handleFretTouch,
    checkPlayAnswer,
  };
}
