const A4 = 440;

export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export function freqToMidi(freq: number) {
  return 69 + 12 * Math.log2(freq / A4);
}

export function midiToFreq(midi: number) {
  return A4 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi: number) {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}

export function midiToOctave(midi: number) {
  return Math.floor(midi / 12) - 1;
}

export function centsBetween(freq: number, reference: number) {
  return 1200 * Math.log2(freq / reference);
}

export function freqToNoteInfo(freq: number) {
  const midi = Math.round(freqToMidi(freq));
  const targetFreq = midiToFreq(midi);

  return {
    midi,
    name: midiToName(midi),
    octave: midiToOctave(midi),
    targetFreq,
    cents: centsBetween(freq, targetFreq),
  };
}
