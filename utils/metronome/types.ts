export type TimeSignature = {
  beats: number;
  noteValue: number;
};

export type Subdivision = "quarter" | "eighth" | "triplet" | "sixteenth";

export type DisplayMode = "pendulum" | "circle";

export interface MetronomeState {
  isPlaying: boolean;
  tempo: number; // 20-300 BPM
  timeSignature: TimeSignature;
  subdivision: Subdivision;
  displayMode: DisplayMode;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  accentFirstBeat: boolean;
  currentBeat: number;
  currentSubBeat: number;
}

export interface MetronomeSettings {
  tempo: number;
  timeSignature: TimeSignature;
  subdivision: Subdivision;
  displayMode: DisplayMode;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  accentFirstBeat: boolean;
}

export interface FavoriteTempo {
  id: string;
  tempo: number;
  label?: string;
}

// 더 다양한 박자 추가
export const DEFAULT_TIME_SIGNATURES: TimeSignature[] = [
  // 단순 박자
  { beats: 2, noteValue: 4 },  // 2/4
  { beats: 3, noteValue: 4 },  // 3/4
  { beats: 4, noteValue: 4 },  // 4/4
  // 복합 박자
  { beats: 5, noteValue: 4 },  // 5/4
  { beats: 6, noteValue: 8 },  // 6/8
  { beats: 7, noteValue: 8 },  // 7/8
  { beats: 9, noteValue: 8 },  // 9/8
  { beats: 12, noteValue: 8 }, // 12/8
];

export const SUBDIVISIONS: { value: Subdivision; label: string; icon: string }[] = [
  { value: "quarter", label: "4", icon: "♩" },
  { value: "eighth", label: "8", icon: "♫" },
  { value: "triplet", label: "3", icon: "♫³" },
  { value: "sixteenth", label: "16", icon: "♬" },
];

export const DEFAULT_SETTINGS: MetronomeSettings = {
  tempo: 120,
  timeSignature: { beats: 4, noteValue: 4 },
  subdivision: "quarter",
  displayMode: "circle",
  soundEnabled: true,
  hapticEnabled: true,
  accentFirstBeat: true,
};

export const MIN_TEMPO = 20;
export const MAX_TEMPO = 300;
