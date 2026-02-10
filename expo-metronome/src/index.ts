import { requireNativeModule, EventEmitter, Subscription } from 'expo-modules-core';

const ExpoMetronome = requireNativeModule('ExpoMetronome');
const emitter = new EventEmitter(ExpoMetronome);

export interface BeatEvent {
  beat: number;
  isAccent: boolean;
  tempo: number;
  subBeat?: number;
}

export const isAvailable = true;

export function start(
  bpm: number = 120,
  beats: number = 4,
  soundEnabled: boolean = true,
  accentEnabled: boolean = true
): void {
  ExpoMetronome.start(bpm, beats, soundEnabled, accentEnabled);
}

export function stop(): void {
  ExpoMetronome.stop();
}

export function setTempo(bpm: number): void {
  ExpoMetronome.setTempo(bpm);
}

export function setBeats(beats: number): void {
  ExpoMetronome.setBeats(beats);
}

export function setSubdivision(sub: number): void {
  if (typeof ExpoMetronome.setSubdivision === 'function') {
    ExpoMetronome.setSubdivision(sub);
  }
}

export function setSoundEnabled(enabled: boolean): void {
  ExpoMetronome.setSoundEnabled(enabled);
}

export function setAccentEnabled(enabled: boolean): void {
  ExpoMetronome.setAccentEnabled(enabled);
}

export function isPlaying(): boolean {
  return ExpoMetronome.isPlaying();
}

export function onBeat(callback: (event: BeatEvent) => void): Subscription {
  return emitter.addListener('onBeat', callback);
}
