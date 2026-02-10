import { useCallback, useEffect, useRef, useState } from "react";
import * as ExpoMetronome from "expo-metronome";
import * as Haptics from "expo-haptics";
import {
  MetronomeSettings,
  Subdivision,
  TimeSignature,
  DEFAULT_SETTINGS,
  MIN_TEMPO,
  MAX_TEMPO,
} from "@/utils/metronome/types";

interface UseMetronomeOptions {
  onBeat?: (beat: number, isAccent: boolean) => void;
  onSubBeat?: (subBeat: number) => void;
}

interface UseMetronomeReturn {
  isPlaying: boolean;
  currentBeat: number;
  currentSubBeat: number;
  tempo: number;
  timeSignature: TimeSignature;
  subdivision: Subdivision;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  accentFirstBeat: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setTempo: (tempo: number) => void;
  setTimeSignature: (ts: TimeSignature) => void;
  setSubdivision: (sub: Subdivision) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticEnabled: (enabled: boolean) => void;
  setAccentFirstBeat: (enabled: boolean) => void;
  adjustTempo: (delta: number) => void;
}

function getSubdivisionValue(sub: Subdivision): number {
  switch (sub) {
    case "quarter": return 1;
    case "eighth": return 2;
    case "triplet": return 3;
    case "sixteenth": return 4;
  }
}

export function useMetronome(
  initialSettings?: Partial<MetronomeSettings>,
  options?: UseMetronomeOptions
): UseMetronomeReturn {
  const settings = { ...DEFAULT_SETTINGS, ...initialSettings };

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [currentSubBeat, setCurrentSubBeat] = useState(0);
  const [tempo, setTempoState] = useState(settings.tempo);
  const [timeSignature, setTimeSignatureState] = useState(settings.timeSignature);
  const [subdivision, setSubdivisionState] = useState(settings.subdivision);
  const [soundEnabled, setSoundEnabledState] = useState(settings.soundEnabled);
  const [hapticEnabled, setHapticEnabledState] = useState(settings.hapticEnabled);
  const [accentFirstBeat, setAccentFirstBeatState] = useState(settings.accentFirstBeat);

  const hapticEnabledRef = useRef(hapticEnabled);
  const optionsRef = useRef(options);

  useEffect(() => { hapticEnabledRef.current = hapticEnabled; }, [hapticEnabled]);
  useEffect(() => { optionsRef.current = options; }, [options]);

  // 네이티브 모듈 이벤트 리스너
  useEffect(() => {
    const subscription = ExpoMetronome.onBeat((event) => {
      setCurrentBeat(event.beat);

      // 햅틱 피드백
      if (hapticEnabledRef.current) {
        Haptics.impactAsync(
          event.isAccent
            ? Haptics.ImpactFeedbackStyle.Heavy
            : Haptics.ImpactFeedbackStyle.Medium
        ).catch(() => {});
      }

      // 콜백
      optionsRef.current?.onBeat?.(event.beat, event.isAccent);
    });

    return () => subscription.remove();
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => ExpoMetronome.stop();
  }, []);

  const play = useCallback(() => {
    setIsPlaying(true);
    setCurrentBeat(0);
    ExpoMetronome.setSubdivision(getSubdivisionValue(subdivision));
    ExpoMetronome.start(tempo, timeSignature.beats, soundEnabled, accentFirstBeat);
  }, [tempo, timeSignature.beats, soundEnabled, accentFirstBeat, subdivision]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    ExpoMetronome.stop();
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const setTempo = useCallback((newTempo: number) => {
    const clampedTempo = Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, Math.round(newTempo)));
    setTempoState(clampedTempo);
    ExpoMetronome.setTempo(clampedTempo);
  }, []);

  const adjustTempo = useCallback((delta: number) => {
    setTempoState((prev) => {
      const newTempo = Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, prev + delta));
      ExpoMetronome.setTempo(newTempo);
      return newTempo;
    });
  }, []);

  const setTimeSignature = useCallback((ts: TimeSignature) => {
    setTimeSignatureState(ts);
    ExpoMetronome.setBeats(ts.beats);
    if (currentBeat >= ts.beats) {
      setCurrentBeat(0);
    }
  }, [currentBeat]);

  const setSubdivision = useCallback((sub: Subdivision) => {
    setSubdivisionState(sub);
    setCurrentSubBeat(0);
    ExpoMetronome.setSubdivision(getSubdivisionValue(sub));
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    ExpoMetronome.setSoundEnabled(enabled);
  }, []);

  const setHapticEnabled = useCallback((enabled: boolean) => {
    setHapticEnabledState(enabled);
  }, []);

  const setAccentFirstBeat = useCallback((enabled: boolean) => {
    setAccentFirstBeatState(enabled);
    ExpoMetronome.setAccentEnabled(enabled);
  }, []);

  return {
    isPlaying,
    currentBeat,
    currentSubBeat,
    tempo,
    timeSignature,
    subdivision,
    soundEnabled,
    hapticEnabled,
    accentFirstBeat,
    play,
    pause,
    toggle,
    setTempo,
    setTimeSignature,
    setSubdivision,
    setSoundEnabled,
    setHapticEnabled,
    setAccentFirstBeat,
    adjustTempo,
  };
}
