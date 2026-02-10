const A4 = 440;

const NOTE_NAMES = [
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

export function freqToNoteInfo(freq: number) {
  const midiFloat = freqToMidi(freq);
  const midi = Math.round(midiFloat);

  const targetFreq = midiToFreq(midi);
  const cents = 1200 * Math.log2(freq / targetFreq);

  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;

  return { midi, name, octave, targetFreq, cents };
}
