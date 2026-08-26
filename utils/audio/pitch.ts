// McLeod Pitch Method (MPM) pitch detection, with FFT-accelerated autocorrelation.
// Reference: McLeod & Wyvill (2005), "A Smarter Way to Find Pitch".
//
// Replaces the previous plain-YIN implementation for two reasons:
// - The difference function there was an O(n^2) direct sum (~1M ops for a 2048-sample
//   window), which forced the caller to throttle detection to every other audio hop.
//   Computing the autocorrelation via FFT (Wiener-Khinchin theorem) instead is
//   O(n log n) and costs a fraction of a millisecond, so every hop can be analyzed.
// - MPM's peak-picking (the first "key maximum" within `CLARITY_THRESHOLD` of the
//   global peak, rather than the first threshold crossing) is more resistant to
//   octave errors on real plucked-string tones, where an overtone can outweigh the
//   fundamental. It also yields a natural 0..1 confidence value (`clarity`) that
//   callers can use to gate false locks on noise.

import { fftInPlace, nextPow2 } from "./fft";

export type PitchDetection = {
  freq: number;
  clarity: number; // 0..1 confidence, from the chosen NSDF peak height
};

const CLARITY_THRESHOLD = 0.93; // McLeod's "k" - accept the first peak within 93% of the global max
const MIN_CLARITY = 0.5; // below this the signal isn't periodic enough to trust at all
const HIGHPASS_CUTOFF_HZ = 35; // kills DC/rumble well below any supported note, nothing musical

// ---- reusable scratch buffers, lazily (re)sized to the caller's window length ----
let scratchWindowSize = 0;
let scratchFftSize = 0;
let scratchRe: Float64Array;
let scratchIm: Float64Array;
let scratchPrefixSq: Float64Array;
let scratchNsdf: Float64Array;
let scratchFiltered: Float64Array;

function ensureScratch(windowSize: number) {
  if (scratchWindowSize === windowSize) return;
  scratchWindowSize = windowSize;
  scratchFftSize = nextPow2(2 * windowSize);
  scratchRe = new Float64Array(scratchFftSize);
  scratchIm = new Float64Array(scratchFftSize);
  scratchPrefixSq = new Float64Array(windowSize + 1);
  scratchNsdf = new Float64Array(windowSize);
  scratchFiltered = new Float64Array(windowSize);
}

// DC removal + one-pole high-pass. Cleans up mic rumble/handling noise without
// touching anything in the supported musical range.
function preprocess(input: Float32Array, sampleRate: number): Float64Array {
  const n = input.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += input[i];
  mean /= n;

  const rc = 1 / (2 * Math.PI * HIGHPASS_CUTOFF_HZ);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);

  const out = scratchFiltered;
  let prevIn = input[0] - mean;
  let prevOut = 0;
  out[0] = 0;
  for (let i = 1; i < n; i++) {
    const x = input[i] - mean;
    prevOut = alpha * (prevOut + x - prevIn);
    prevIn = x;
    out[i] = prevOut;
  }
  return out;
}

// Autocorrelation via Wiener-Khinchin: acf = IFFT(FFT(x) * conj(FFT(x))).
// `filtered` must already be zero-padded into scratchRe/scratchIm by the caller.
function autocorrelationFFT(): Float64Array {
  fftInPlace(scratchRe, scratchIm, false);
  for (let i = 0; i < scratchFftSize; i++) {
    const power = scratchRe[i] * scratchRe[i] + scratchIm[i] * scratchIm[i];
    scratchRe[i] = power;
    scratchIm[i] = 0;
  }
  fftInPlace(scratchRe, scratchIm, true);
  return scratchRe; // re[tau] = autocorrelation at lag tau, valid for tau = 0..windowSize-1
}

/**
 * Detects the fundamental frequency of `input` within [minFreq, maxFreq].
 * Returns null if the signal isn't periodic enough to trust (see MIN_CLARITY).
 */
export function detectPitch(
  input: Float32Array,
  sampleRate: number,
  minFreq: number,
  maxFreq: number,
): PitchDetection | null {
  const windowSize = input.length;
  const maxLag = Math.min(windowSize - 1, Math.floor(sampleRate / minFreq));
  const minLag = Math.max(1, Math.floor(sampleRate / maxFreq));
  if (maxLag <= minLag) return null;

  ensureScratch(windowSize);
  const filtered = preprocess(input, sampleRate);

  scratchRe.fill(0);
  scratchIm.fill(0);
  scratchRe.set(filtered);
  const acf = autocorrelationFFT();

  const prefixSq = scratchPrefixSq;
  prefixSq[0] = 0;
  for (let i = 0; i < windowSize; i++) {
    prefixSq[i + 1] = prefixSq[i] + filtered[i] * filtered[i];
  }
  const totalSq = prefixSq[windowSize];

  const nsdf = scratchNsdf;
  for (let tau = 0; tau <= maxLag; tau++) {
    const e1 = prefixSq[windowSize - tau]; // sum x(j)^2, j = 0..W-tau-1
    const e2 = totalSq - prefixSq[tau]; // sum x(j+tau)^2, j = 0..W-tau-1
    const m = e1 + e2;
    nsdf[tau] = m > 0 ? (2 * acf[tau]) / m : 0;
  }

  // McLeod peak-picking: within each lobe between a positive-going and the following
  // negative-going zero crossing, keep only the local maximum ("key maximum"). Then
  // pick the first key maximum within CLARITY_THRESHOLD of the global one - favors the
  // fundamental's peak over a stronger-but-wrong harmonic peak at a shorter lag.
  let bestTau = -1;
  let bestValue = 0;
  let maxPeakValue = 0;
  const peakTaus: number[] = [];
  const peakValues: number[] = [];

  let tau = 1;
  while (tau < maxLag) {
    while (tau < maxLag && nsdf[tau] > 0) tau++;
    if (tau >= maxLag) break;
    while (tau < maxLag && nsdf[tau] <= 0) tau++;

    let peakTau = tau;
    let peakVal = nsdf[tau];
    while (tau < maxLag && nsdf[tau] > 0) {
      if (nsdf[tau] > peakVal) {
        peakVal = nsdf[tau];
        peakTau = tau;
      }
      tau++;
    }
    if (peakTau >= minLag && peakTau <= maxLag) {
      peakTaus.push(peakTau);
      peakValues.push(peakVal);
      if (peakVal > maxPeakValue) maxPeakValue = peakVal;
    }
  }

  if (peakTaus.length === 0 || maxPeakValue < MIN_CLARITY) return null;

  for (let i = 0; i < peakTaus.length; i++) {
    if (peakValues[i] >= CLARITY_THRESHOLD * maxPeakValue) {
      bestTau = peakTaus[i];
      bestValue = peakValues[i];
      break;
    }
  }

  // Parabolic interpolation around the chosen peak for sub-sample lag accuracy.
  let betterTau = bestTau;
  if (bestTau > minLag && bestTau < maxLag) {
    const s0 = nsdf[bestTau - 1];
    const s1 = nsdf[bestTau];
    const s2 = nsdf[bestTau + 1];
    const denom = 2 * (2 * s1 - s0 - s2);
    if (Math.abs(denom) > 1e-12) {
      const shift = (s2 - s0) / denom;
      if (Math.abs(shift) < 1) betterTau = bestTau + shift;
    }
  }

  const freq = sampleRate / betterTau;
  if (freq < minFreq || freq > maxFreq) return null;

  return { freq, clarity: bestValue };
}

// Adaptive smoothing: snaps instantly on a genuine note change (confirmed across two
// consecutive readings so a single stray frame can't flicker the display), and gently
// smooths small jitter/vibrato while a note is held so the reading doesn't wobble.
const JUMP_CENTS = 50; // half a semitone - past this it's "a different note", not jitter
const CONFIRM_CENTS = 20; // how tightly two consecutive jump candidates must agree
const SMOOTHING = 0.3; // EMA factor applied only while holding within the same note

export class PitchTracker {
  private smoothedFreq: number | null = null;
  private pendingFreq: number | null = null;

  update(detection: PitchDetection | null): number | null {
    if (!detection) return this.smoothedFreq;
    const freq = detection.freq;

    if (this.smoothedFreq == null) {
      this.smoothedFreq = freq;
      this.pendingFreq = null;
      return freq;
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
