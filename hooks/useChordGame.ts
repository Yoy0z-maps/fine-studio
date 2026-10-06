import { useState, useCallback, useEffect, useRef } from "react";
import { useSharedValue, withTiming, SharedValue } from "react-native-reanimated";
import { loadChord } from "@/utils/chords/chordData";
import { shuffled } from "@/utils/shuffle";
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
    // The chord data names black keys with sharps - "Eb"/"Ab"/"Bb" matched nothing.
    roots: ["C", "D", "E", "F", "G", "A", "B", "C#", "D#", "F#", "G#", "A#"],
    maxFret: 12,
  },
};

// GameFretboard's interactive touch grid can't adapt to the hidden answer's
// fret range without leaking it, so it always offers this fixed window.
const INTERACTIVE_FRET_COUNT = 5;

type ChordCandidate = {
  root: string;
  suffix: string;
  displayName: string;
  position: ChordPosition;
  allPositions: ChordPosition[];
};

// A pool depends only on static data, so each (difficulty, mode) pool is built once instead of
// re-parsing every matching chord's voicings for every question.
const candidatePools = new Map<string, ChordCandidate[]>();

function getCandidates(difficulty: Difficulty, gameMode: GameMode): ChordCandidate[] {
  const cacheKey = `${difficulty}:${gameMode}`;
  const cached = candidatePools.get(cacheKey);
  if (cached) return cached;

  const config = DIFFICULTY_CONFIG[difficulty];
  const pool: ChordCandidate[] = [];

  for (const root of config.roots) {
    // Exact chord types only: matching by prefix pulled in every variant sharing one - "7" also
    // brought "7#9b5", "7sus4" and all their slash chords into the level-2 pool (132 types).
    for (const suffix of config.chords) {
      const data = loadChord(root, suffix);
      if (!data?.positions?.length) continue;

      // "Play" mode requires the user to tap out the answer on a fixed 1-5
      // fret grid, so only voicings that fit in it can ever be answered
      // correctly. "Identify" mode just displays the chord (GameFretboard
      // sizes itself to fit any position), so it isn't limited this way.
      const rawPosition =
        gameMode === "play"
          ? data.positions.find((p) => {
              const played = parseFrets(p.frets).filter((f: number) => f > 0);
              return (
                played.length === 0 ||
                Math.max(...played) <= INTERACTIVE_FRET_COUNT
              );
            })
          : data.positions[0];
      if (!rawPosition) continue;

      const frets = parseFrets(rawPosition.frets);
      const playedFrets = frets.filter((f: number) => f > 0);
      const maxFret = playedFrets.length > 0 ? Math.max(...playedFrets) : 0;
      if (maxFret > config.maxFret) continue;

      const allPositions: ChordPosition[] = data.positions.map((p) => ({
        frets: parseFrets(p.frets),
        fingers: parseFingers(p.fingers),
        barres: parseBarres(p.barres),
        baseFret: p.baseFret || 1,
      }));

      pool.push({
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

  candidatePools.set(cacheKey, pool);
  return pool;
}

function getRandomChord(
  difficulty: Difficulty,
  gameMode: GameMode
): GameQuestion | null {
  const candidates = getCandidates(difficulty, gameMode);
  if (candidates.length === 0) return null;

  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  const otherChords = shuffled(
    candidates.filter((c) => c.displayName !== selected.displayName)
  )
    .slice(0, 3)
    .map((c) => c.displayName);

  return {
    chordName: selected.displayName,
    root: selected.root,
    suffix: selected.suffix,
    position: selected.position,
    allPositions: selected.allPositions,
    options: shuffled([selected.displayName, ...otherChords]),
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
  // The pause before the next question. Cleared when a game ends or restarts, so a pending one
  // can't swap a question (built for the old difficulty/mode) into the next game.
  const nextQuestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNextQuestionTimer = useCallback(() => {
    if (nextQuestionTimerRef.current) {
      clearTimeout(nextQuestionTimerRef.current);
      nextQuestionTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearNextQuestionTimer, [clearNextQuestionTimer]);

  const nextQuestion = useCallback(() => {
    const newQuestion = getRandomChord(difficulty, gameMode);
    setQuestion(newQuestion);
    setFeedback(null);
    setShowAnswer(false);
    setUserFrets([-1, -1, -1, -1, -1, -1]);
  }, [difficulty, gameMode]);

  const startGame = useCallback(() => {
    clearNextQuestionTimer();
    feedbackOpacity.value = 0;
    setIsGameActive(true);
    setScore(0);
    setTotalQuestions(0);
    setFeedback(null);
    setShowAnswer(false);
    setUserFrets([-1, -1, -1, -1, -1, -1]);
    const newQuestion = getRandomChord(difficulty, gameMode);
    setQuestion(newQuestion);
  }, [difficulty, gameMode, clearNextQuestionTimer, feedbackOpacity]);

  const endGame = useCallback(() => {
    clearNextQuestionTimer();
    feedbackOpacity.value = 0;
    setIsGameActive(false);
  }, [clearNextQuestionTimer, feedbackOpacity]);

  const handleIdentifyAnswer = useCallback(
    (answer: string) => {
      if (!question || feedback) return;
      const isCorrect = answer === question.chordName;
      setFeedback(isCorrect ? "correct" : "wrong");
      setTotalQuestions((prev) => prev + 1);
      if (isCorrect) setScore((prev) => prev + 1);

      feedbackOpacity.value = withTiming(1, { duration: 200 });
      nextQuestionTimerRef.current = setTimeout(() => {
        nextQuestionTimerRef.current = null;
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
    nextQuestionTimerRef.current = setTimeout(() => {
      nextQuestionTimerRef.current = null;
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
