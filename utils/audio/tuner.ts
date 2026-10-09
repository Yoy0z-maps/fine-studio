import { Instrument, InstrumentString, nearestString } from "./instruments";
import { centsBetween, freqToNoteInfo } from "./note";
import { PitchTracker } from "./pitch";

// Turns expo-pcm-stream's per-hop pitch events into what the tuner screen shows: which string
// (or note) is being tuned, how far off it is, and whether it's IN TUNE. Kept free of React so
// it can be tested on its own.

/** "strings": tune the instrument's open strings; "chromatic": any note. */
export type TunerMode = "strings" | "chromatic";

/** One `onPitch` event from expo-pcm-stream. */
export type PitchSample = { frequency: number | null; clarity: number; rms: number };

export type TunerReading = {
  /** The smoothed detected frequency. */
  hz?: number;
  note?: string;
  octave?: number;
  /** Deviation from the target: the string being tuned, or the nearest note. */
  cents?: number;
  targetHz?: number;
  /** Strings mode: the number of the string being tuned. */
  stringNumber?: number;
  locked: boolean;
};

/** RMS below which a hop counts as silence (also the native detector's gate). */
export const SILENCE_THRESHOLD = 0.002;
const FADE_OUT_MS = 300; // the last reading stays up this long after the sound stops
const SWITCH_CENTS = 35; // automatic string choice: hysteresis before moving to another string
/** IN TUNE once within this many cents for LOCK_MS... */
export const LOCK_ENTER_CENTS = 3;
const LOCK_MS = 400;
/** ...and it stays IN TUNE until the pitch strays further than this. */
export const LOCK_EXIT_CENTS = 6;

export class TunerEngine {
  private instrument: Instrument;
  private mode: TunerMode;
  private pinned: InstrumentString | null = null;
  private readonly tracker = new PitchTracker();
  private target: InstrumentString | null = null;
  private lockKey: string | null = null;
  private lockSince: number | null = null;
  private locked = false;
  private silentSince: number | null = null;
  private reading: TunerReading = { locked: false };

  constructor(instrument: Instrument, mode: TunerMode) {
    this.instrument = instrument;
    this.mode = mode;
  }

  /** Switches instrument or mode; the string choice goes back to automatic. */
  configure(instrument: Instrument, mode: TunerMode): void {
    this.instrument = instrument;
    this.mode = mode;
    this.pinned = null;
    this.reset();
  }

  /**
   * Tunes one string regardless of what's played (null: pick the nearest string automatically).
   * Needed when a string is detuned past halfway to its neighbor - a ukulele's G and A strings
   * are only a whole tone apart.
   */
  pinString(stringNumber: number | null): void {
    this.pinned =
      stringNumber == null
        ? null
        : (this.instrument.strings.find((s) => s.number === stringNumber) ?? null);
    this.target = null;
    this.clearLock();
    // The held pitch is re-measured against the new target on the next event.
  }

  reset(): void {
    this.tracker.reset();
    this.target = null;
    this.clearLock();
    this.silentSince = null;
    this.reading = { locked: false };
  }

  /** Feeds one pitch event (`now` in ms) and returns the reading to show. */
  process(sample: PitchSample, now: number): TunerReading {
    if (sample.rms < SILENCE_THRESHOLD) {
      if (this.silentSince == null) this.silentSince = now;
      if (now - this.silentSince >= FADE_OUT_MS) {
        this.tracker.reset();
        this.target = null;
        this.clearLock();
        this.reading = { locked: false };
      } else if (this.reading.locked || this.lockSince != null) {
        // A new attack has to qualify for IN TUNE again.
        this.clearLock();
        this.reading = { ...this.reading, locked: false };
      }
      return this.reading;
    }
    this.silentSince = null;

    const confident = sample.frequency != null && sample.clarity >= this.instrument.minClarity;
    const hz = this.tracker.update(sample.frequency, confident);
    if (hz == null) return this.reading;

    let reading: TunerReading;
    let key: string;
    if (this.mode === "strings") {
      const target = this.pinned ?? this.pickString(hz);
      reading = {
        hz,
        note: target.name,
        octave: target.octave,
        cents: centsBetween(hz, target.frequency),
        targetHz: target.frequency,
        stringNumber: target.number,
        locked: false,
      };
      key = `string-${target.number}`;
    } else {
      const note = freqToNoteInfo(hz);
      reading = {
        hz,
        note: note.name,
        octave: note.octave,
        cents: note.cents,
        targetHz: note.targetFreq,
        locked: false,
      };
      key = `note-${note.midi}`;
    }

    // Only a fresh, confident detection may advance or reset the lock: a single miss (the held
    // pitch is still shown) keeps whatever lock state was in progress instead of flickering.
    if (confident) this.updateLock(key, reading.cents!, now);
    reading.locked = this.locked;
    this.reading = reading;
    return reading;
  }

  private pickString(hz: number): InstrumentString {
    const nearest = nearestString(this.instrument, hz);
    if (
      this.target == null ||
      Math.abs(nearest.cents) + SWITCH_CENTS < Math.abs(centsBetween(hz, this.target.frequency))
    ) {
      this.target = nearest.string;
    }
    return this.target;
  }

  private updateLock(key: string, cents: number, now: number): void {
    if (key !== this.lockKey) {
      this.lockKey = key;
      this.locked = false;
      this.lockSince = null;
    }
    const off = Math.abs(cents);
    if (this.locked) {
      if (off > LOCK_EXIT_CENTS) {
        this.locked = false;
        this.lockSince = null;
      }
      return;
    }
    if (off <= LOCK_ENTER_CENTS) {
      if (this.lockSince == null) this.lockSince = now;
      if (now - this.lockSince >= LOCK_MS) this.locked = true;
    } else {
      this.lockSince = null;
    }
  }

  private clearLock(): void {
    this.lockKey = null;
    this.lockSince = null;
    this.locked = false;
  }
}
