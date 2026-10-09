import { centsBetween, midiToFreq, midiToName, midiToOctave } from "./note";

export type InstrumentId = "guitar" | "ukulele" | "bass" | "violin" | "cello";

export type FrequencyRange = { minFrequency: number; maxFrequency: number };

export type InstrumentString = {
  /** Numbered the way players do, from 1 for the highest-pitched string. */
  number: number;
  midi: number;
  name: string;
  octave: number;
  frequency: number;
};

export type Instrument = {
  id: InstrumentId;
  /** Open strings in the order a player sees them, lowest-numbered (1) last. */
  strings: InstrumentString[];
  /**
   * Analysis window in samples. The native refinement needs ~4.5 periods of the lowest note to
   * resolve its partials (2.5 at the least) - 4096 at 48 kHz covers down to ~50 Hz, a bass's
   * low E (41 Hz) needs 8192. Larger windows also average more but react more slowly.
   */
  windowSize: number;
  /** Open strings, each detuned up to ~5 semitones either way. */
  stringRange: FrequencyRange;
  /** Everything the instrument plays, for chromatic mode. */
  chromaticRange: FrequencyRange;
  /**
   * Lowest detection clarity that may start a new note or count toward IN TUNE. A bass's stiff
   * low strings rarely read above ~0.8 through a phone microphone; everything else reads >0.9.
   */
  minClarity: number;
};

const openString = (number: number, midi: number): InstrumentString => ({
  number,
  midi,
  name: midiToName(midi),
  octave: midiToOctave(midi),
  frequency: midiToFreq(midi),
});

export const INSTRUMENTS: Record<InstrumentId, Instrument> = {
  guitar: {
    id: "guitar",
    // E2 A2 D3 G3 B3 E4
    strings: [openString(6, 40), openString(5, 45), openString(4, 50), openString(3, 55), openString(2, 59), openString(1, 64)],
    windowSize: 4096,
    stringRange: { minFrequency: 60, maxFrequency: 440 },
    chromaticRange: { minFrequency: 60, maxFrequency: 1400 },
    minClarity: 0.7,
  },
  ukulele: {
    id: "ukulele",
    // Re-entrant G4 C4 E4 A4
    strings: [openString(4, 67), openString(3, 60), openString(2, 64), openString(1, 69)],
    windowSize: 4096,
    stringRange: { minFrequency: 160, maxFrequency: 620 },
    chromaticRange: { minFrequency: 160, maxFrequency: 1400 },
    minClarity: 0.7,
  },
  bass: {
    id: "bass",
    // E1 A1 D2 G2
    strings: [openString(4, 28), openString(3, 33), openString(2, 38), openString(1, 43)],
    windowSize: 8192,
    stringRange: { minFrequency: 30, maxFrequency: 140 },
    chromaticRange: { minFrequency: 28, maxFrequency: 450 },
    minClarity: 0.6,
  },
  violin: {
    id: "violin",
    // G3 D4 A4 E5
    strings: [openString(4, 55), openString(3, 62), openString(2, 69), openString(1, 76)],
    windowSize: 4096,
    stringRange: { minFrequency: 145, maxFrequency: 900 },
    chromaticRange: { minFrequency: 145, maxFrequency: 2800 },
    minClarity: 0.7,
  },
  cello: {
    id: "cello",
    // C2 G2 D3 A3
    strings: [openString(4, 36), openString(3, 43), openString(2, 50), openString(1, 57)],
    windowSize: 4096,
    stringRange: { minFrequency: 48, maxFrequency: 300 },
    chromaticRange: { minFrequency: 48, maxFrequency: 1100 },
    minClarity: 0.7,
  },
};

export const INSTRUMENT_IDS = Object.keys(INSTRUMENTS) as InstrumentId[];

export function isInstrumentId(value: unknown): value is InstrumentId {
  return INSTRUMENT_IDS.includes(value as InstrumentId);
}

/** The open string closest to `freq`, and how far off it is. */
export function nearestString(instrument: Instrument, freq: number) {
  let best = instrument.strings[0];
  let bestCents = centsBetween(freq, best.frequency);
  for (const s of instrument.strings) {
    const cents = centsBetween(freq, s.frequency);
    if (Math.abs(cents) < Math.abs(bestCents)) {
      best = s;
      bestCents = cents;
    }
  }
  return { string: best, cents: bestCents };
}
