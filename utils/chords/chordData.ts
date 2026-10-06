import {
  CHORD_FILES_MAP,
  CHORDS_WITHOUT_VOICINGS,
} from "@/assets/data/chords/CHORD_FILES_MAP";
import { ChordFileData, ChordItem } from "@/types/chord";

/** Loads one chord's file. Each file is evaluated the first time it's requested, then cached. */
export function loadChord(root: string, suffix: string): ChordFileData | undefined {
  return CHORD_FILES_MAP[root]?.[suffix]?.();
}

/**
 * The name a chord's file displays (`key` + `suffix`), derived from its map key so listing and
 * searching don't have to load the files: "11_a#" is the slash chord "11/A#".
 */
export function chordDisplayName(root: string, suffix: string): string {
  const slash = suffix.lastIndexOf("_");
  if (slash < 0) return `${root}${suffix}`;
  return `${root}${suffix.slice(0, slash)}/${suffix.slice(slash + 1).toUpperCase()}`;
}

export function hasVoicings(root: string, suffix: string): boolean {
  return CHORD_FILES_MAP[root]?.[suffix] != null && !CHORDS_WITHOUT_VOICINGS.has(`${root}/${suffix}`);
}

type SearchEntry = ChordItem & { searchName: string };

let searchIndex: SearchEntry[] | null = null;

/** Every chord that has voicings, in map order, with its lowercased name for matching. */
export function getChordSearchIndex(): readonly SearchEntry[] {
  if (!searchIndex) {
    searchIndex = [];
    for (const root of Object.keys(CHORD_FILES_MAP)) {
      for (const suffix of Object.keys(CHORD_FILES_MAP[root])) {
        if (CHORDS_WITHOUT_VOICINGS.has(`${root}/${suffix}`)) continue;
        const displayName = chordDisplayName(root, suffix);
        searchIndex.push({ root, suffix, displayName, searchName: displayName.toLowerCase() });
      }
    }
  }
  return searchIndex;
}
