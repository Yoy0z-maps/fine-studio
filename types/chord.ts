/**
 * 코드 관련 타입 정의
 */

// 코드 포지션 (파싱된 형태)
export interface ChordPosition {
  frets: number[];
  fingers: number[];
  barres?: number[];
  baseFret: number;
}

// 코드 포지션 (원본 데이터)
export interface RawChordPosition {
  frets: string;
  fingers: string;
  barres?: string;
  baseFret?: number;
}

// 코드 아이템 (목록용)
export interface ChordItem {
  root: string;
  suffix: string;
  displayName: string;
}

// 저장된 코드 (즐겨찾기/최근)
export interface StoredChord {
  root: string;
  suffix: string;
  displayName: string;
}

// 게임 모드
export type GameMode = "identify" | "play";

// 난이도 (1-5)
export type Difficulty = 1 | 2 | 3 | 4 | 5;

// 게임 문제
export interface GameQuestion {
  chordName: string;
  root: string;
  suffix: string;
  position: ChordPosition;
  allPositions: ChordPosition[];
  options: string[];
}

// 난이도 설정
export interface DifficultyConfig {
  chords: string[];
  roots: string[];
  maxFret: number;
}

// 게임 피드백
export type GameFeedback = "correct" | "wrong" | null;

// 손가락 색상
export const FINGER_COLORS: Record<number, string> = {
  1: "#FF5722", // 검지 - 주황
  2: "#2196F3", // 중지 - 파랑
  3: "#4CAF50", // 약지 - 초록
  4: "#9C27B0", // 소지 - 보라
};
