// YIN pitch detection algorithm
// Based on "YIN, a fundamental frequency estimator for speech and music"
// by de Cheveigné & Kawahara (2002)
// Much more robust against octave errors than plain autocorrelation

// Guitar frequency range (with margin for detuning)
const MIN_FREQ = 70; // Below E2 (82.4Hz)
const MAX_FREQ = 400; // Above E4 (329.6Hz)

// YIN threshold - lower = stricter (0.1-0.2 typical)
// 0.20 works better for G string complex harmonics
const YIN_THRESHOLD = 0.20;

export function autoCorrelatePitch(
  input: Float32Array,
  sampleRate: number
): number | null {
  const size = input.length;
  const halfSize = Math.floor(size / 2);

  // Calculate lag range from frequency limits
  const minLag = Math.floor(sampleRate / MAX_FREQ); // ~110 samples at 44100Hz
  const maxLag = Math.floor(sampleRate / MIN_FREQ); // ~630 samples at 44100Hz

  // Ensure we have enough samples
  if (halfSize < maxLag) return null;

  // Step 1: DC removal
  let mean = 0;
  for (let i = 0; i < size; i++) mean += input[i];
  mean /= size;

  const buf = new Float32Array(size);
  for (let i = 0; i < size; i++) buf[i] = input[i] - mean;

  // Step 2: Compute difference function d(tau)
  // d(tau) = sum of (buf[j] - buf[j+tau])^2
  const diff = new Float32Array(halfSize);
  for (let tau = 0; tau < halfSize; tau++) {
    let sum = 0;
    for (let j = 0; j < halfSize; j++) {
      const delta = buf[j] - buf[j + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  // Step 3: Cumulative mean normalized difference function (CMNDF)
  // This is the key to YIN - prevents octave errors
  const cmndf = new Float32Array(halfSize);
  cmndf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfSize; tau++) {
    runningSum += diff[tau];
    cmndf[tau] = diff[tau] / (runningSum / tau);
  }

  // Step 4: Absolute threshold
  // Find first tau where CMNDF goes below threshold (within frequency range)
  let tauEstimate = -1;
  for (let tau = minLag; tau < Math.min(maxLag, halfSize); tau++) {
    if (cmndf[tau] < YIN_THRESHOLD) {
      // Find the local minimum after crossing threshold
      while (tau + 1 < halfSize && cmndf[tau + 1] < cmndf[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  // No valid pitch found - signal might be noise or out of range
  if (tauEstimate < minLag) return null;

  // Step 5: Parabolic interpolation for sub-sample accuracy
  const t = tauEstimate;
  if (t > 0 && t < halfSize - 1) {
    const s0 = cmndf[t - 1];
    const s1 = cmndf[t];
    const s2 = cmndf[t + 1];
    const shift = (s2 - s0) / (2 * (2 * s1 - s0 - s2));
    if (Math.abs(shift) < 1) {
      const betterTau = t + shift;
      const freq = sampleRate / betterTau;
      // Final range check
      if (freq >= MIN_FREQ && freq <= MAX_FREQ) {
        return freq;
      }
    }
  }

  const freq = sampleRate / tauEstimate;
  if (freq >= MIN_FREQ && freq <= MAX_FREQ) {
    return freq;
  }

  return null;
}

// Median filter for smoothing pitch detection
// Removes outliers that cause UI flickering
const HISTORY_SIZE = 5;
let pitchHistory: number[] = [];

export function getSmoothedPitch(rawPitch: number | null): number | null {
  if (rawPitch === null) {
    // Keep some history for continuity, but decay
    if (pitchHistory.length > 0) {
      pitchHistory.shift();
    }
    return null;
  }

  pitchHistory.push(rawPitch);
  if (pitchHistory.length > HISTORY_SIZE) {
    pitchHistory.shift();
  }

  if (pitchHistory.length < 3) return rawPitch;

  // Median filter - removes outliers
  const sorted = [...pitchHistory].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function resetPitchHistory() {
  pitchHistory = [];
}
