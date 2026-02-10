/**
 * 스케일 관련 타입 정의
 */

// 스트링별 포지션
export interface StringPosition {
  string: number; // 1-6 (1=high E, 6=low E)
  frets: number[]; // 해당 스트링에서 누를 프렛들
  notes?: string[]; // 음 이름 (옵션)
  root_frets: number[]; // 루트 음이 있는 프렛들
  blue_notes?: number[]; // 블루 노트 (블루스 스케일용)
}

// 패턴 (Box/Position)
export interface ScalePattern {
  start_fret?: number; // 시작 프렛 (major/minor용)
  center_fret?: number; // 중심 프렛 (pentatonic용)
  description?: string; // 패턴 설명
  positions: StringPosition[];
}

// 스케일 데이터 (JSON 파일 구조)
export interface ScaleData {
  [scaleName: string]: {
    [patternName: string]: ScalePattern;
  };
}

// 스케일 아이템 (목록용)
export interface ScaleItem {
  id: string; // 파일명 (예: "a_minor")
  name: string; // 표시 이름 (예: "A Minor")
  root: string; // 루트 음 (예: "A")
  type: string; // 스케일 타입 (예: "minor")
}

// 저장된 스케일 (즐겨찾기/최근)
export interface StoredScale {
  id: string;
  name: string;
}

// 게임 모드
export type ScaleGameMode = "identify" | "play";

// 난이도 (1-5)
export type ScaleDifficulty = 1 | 2 | 3 | 4 | 5;

// 게임 문제
export interface ScaleGameQuestion {
  scaleId: string;
  scaleName: string;
  patternKey: string;
  pattern: ScalePattern;
  options: string[];
}

// 난이도 설정
export interface ScaleDifficultyConfig {
  scales: string[];
}

// 게임 피드백
export type ScaleGameFeedback = "correct" | "wrong" | null;

// 루트 노트 색상
export const ROOT_COLOR = "#E53935"; // 빨간색

// 일반 노트 색상
export const NOTE_COLOR = "#2196F3"; // 파란색
