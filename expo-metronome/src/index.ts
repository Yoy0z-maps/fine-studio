import { requireNativeModule, NativeModule, type EventSubscription } from 'expo-modules-core';

export interface BeatEvent {
  beat: number;
  isAccent: boolean;
  tempo: number;
  subBeat?: number;
}

type ExpoMetronomeEvents = {
  onBeat: (event: BeatEvent) => void;
};

declare class ExpoMetronomeModule extends NativeModule<ExpoMetronomeEvents> {
  start(bpm: number, beats: number, soundEnabled: boolean, accentEnabled: boolean): void;
  stop(): void;
  setTempo(bpm: number): void;
  setBeats(beats: number): void;
  setSubdivision?(sub: number): void;
  setSoundEnabled(enabled: boolean): void;
  setAccentEnabled(enabled: boolean): void;
  isPlaying(): boolean;
}

// Native modules are event emitters themselves (SDK 52+).
const ExpoMetronome = requireNativeModule<ExpoMetronomeModule>('ExpoMetronome');

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
  ExpoMetronome.setSubdivision?.(sub);
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

export function onBeat(callback: (event: BeatEvent) => void): EventSubscription {
  return ExpoMetronome.addListener('onBeat', callback);
}
