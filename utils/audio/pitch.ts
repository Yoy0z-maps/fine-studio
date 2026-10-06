// Pitch detection itself runs natively (expo-pcm-stream: McLeod Pitch Method on a continuously
// high-passed stream); this file only smooths its per-hop readings for display.

// Adaptive smoothing: snaps instantly on a genuine note change (confirmed across two
// consecutive readings so a single stray frame can't flicker the display), and gently
// smooths small jitter/vibrato while a note is held so the reading doesn't wobble.
// The first reading after silence is confirmed the same way: room noise produces scattered,
// low-clarity detections that rarely agree twice in a row, while a played note does within
// one extra hop (~21 ms).
const JUMP_CENTS = 50; // half a semitone - past this it's "a different note", not jitter
const CONFIRM_CENTS = 20; // how tightly two consecutive jump candidates must agree
const SMOOTHING = 0.3; // EMA factor applied only while holding within the same note

export class PitchTracker {
  private smoothedFreq: number | null = null;
  private pendingFreq: number | null = null;

  /** `freq` is null when the latest hop had no confident pitch: the held reading is kept. */
  update(freq: number | null): number | null {
    if (freq == null) {
      // Nothing shown yet: the confirming reading has to be the very next one.
      if (this.smoothedFreq == null) this.pendingFreq = null;
      return this.smoothedFreq;
    }

    if (this.smoothedFreq == null) {
      if (
        this.pendingFreq != null &&
        Math.abs(1200 * Math.log2(freq / this.pendingFreq)) <= CONFIRM_CENTS
      ) {
        this.smoothedFreq = freq;
        this.pendingFreq = null;
        return freq;
      }
      this.pendingFreq = freq;
      return null;
    }

    const delta = Math.abs(1200 * Math.log2(freq / this.smoothedFreq));

    if (delta <= JUMP_CENTS) {
      this.pendingFreq = null;
      this.smoothedFreq += SMOOTHING * (freq - this.smoothedFreq);
      return this.smoothedFreq;
    }

    if (
      this.pendingFreq != null &&
      Math.abs(1200 * Math.log2(freq / this.pendingFreq)) <= CONFIRM_CENTS
    ) {
      this.smoothedFreq = freq;
      this.pendingFreq = null;
    } else {
      this.pendingFreq = freq;
    }

    return this.smoothedFreq;
  }

  reset(): void {
    this.smoothedFreq = null;
    this.pendingFreq = null;
  }
}
