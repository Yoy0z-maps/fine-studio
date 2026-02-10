export const GUITAR_STANDARD = [
  { string: 6, name: "E2", freq: 82.4069 },
  { string: 5, name: "A2", freq: 110.0 },
  { string: 4, name: "D3", freq: 146.832 },
  { string: 3, name: "G3", freq: 195.998 },
  { string: 2, name: "B3", freq: 246.942 },
  { string: 1, name: "E4", freq: 329.628 },
];

export function nearestGuitarTarget(freq: number) {
  let best = GUITAR_STANDARD[0];
  let bestDiff = Math.abs(Math.log2(freq / best.freq));

  for (const t of GUITAR_STANDARD) {
    const diff = Math.abs(Math.log2(freq / t.freq));
    if (diff < bestDiff) {
      best = t;
      bestDiff = diff;
    }
  }

  const cents = 1200 * Math.log2(freq / best.freq);
  return { ...best, cents };
}

// Chromatic mode - detect any note, not just guitar strings
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const A4 = 440;

export function nearestChromaticTarget(freq: number) {
  // Convert frequency to MIDI note number
  const midiFloat = 69 + 12 * Math.log2(freq / A4);
  const midi = Math.round(midiFloat);

  // Get note name and octave
  const noteIndex = ((midi % 12) + 12) % 12;
  const name = NOTE_NAMES[noteIndex];
  const octave = Math.floor(midi / 12) - 1;

  // Calculate target frequency and cents deviation
  const targetFreq = A4 * Math.pow(2, (midi - 69) / 12);
  const cents = 1200 * Math.log2(freq / targetFreq);

  return {
    string: 0, // No string in chromatic mode
    name: `${name}${octave}`,
    freq: targetFreq,
    cents,
  };
}
