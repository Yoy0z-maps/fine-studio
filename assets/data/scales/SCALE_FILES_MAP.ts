import { ScaleData, ScaleItem } from "@/types/scale";

import aMinor from "./a_minor.json";
import aBlues from "./a_blues.json";
import cMajor from "./c_major.json";
import cPentatonic from "./c_pentatonic.json";

export const SCALE_FILES_MAP: Record<string, ScaleData> = {
  a_minor: aMinor as ScaleData,
  a_blues: aBlues as ScaleData,
  c_major: cMajor as ScaleData,
  c_pentatonic: cPentatonic as ScaleData,
};

// 스케일 목록 (UI 순서)
export const SCALE_LIST: ScaleItem[] = [
  { id: "c_major", name: "C Major", root: "C", type: "major" },
  { id: "c_pentatonic", name: "C Pentatonic", root: "C", type: "pentatonic" },
  { id: "a_minor", name: "A Minor", root: "A", type: "minor" },
  { id: "a_blues", name: "A Blues", root: "A", type: "blues" },
];

// 스케일 데이터에서 패턴 키 목록 가져오기
export function getPatternKeys(scaleId: string): string[] {
  const scaleData = SCALE_FILES_MAP[scaleId];
  if (!scaleData) return [];

  const scaleName = Object.keys(scaleData)[0];
  if (!scaleName) return [];

  return Object.keys(scaleData[scaleName]);
}

// 스케일 데이터에서 특정 패턴 가져오기
export function getPattern(scaleId: string, patternKey: string) {
  const scaleData = SCALE_FILES_MAP[scaleId];
  if (!scaleData) return null;

  const scaleName = Object.keys(scaleData)[0];
  if (!scaleName) return null;

  return scaleData[scaleName][patternKey] || null;
}

// 스케일 데이터에서 모든 패턴 가져오기
export function getAllPatterns(scaleId: string) {
  const scaleData = SCALE_FILES_MAP[scaleId];
  if (!scaleData) return null;

  const scaleName = Object.keys(scaleData)[0];
  if (!scaleName) return null;

  return scaleData[scaleName];
}
