import { useCallback, useRef, useState } from "react";
import { MIN_TEMPO, MAX_TEMPO } from "@/utils/metronome/types";

interface UseTapTempoOptions {
  onTempoDetected?: (tempo: number) => void;
  minTaps?: number;
  maxTaps?: number;
  resetTimeout?: number;
}

interface UseTapTempoReturn {
  tap: () => void;
  reset: () => void;
  tapCount: number;
  detectedTempo: number | null;
  isActive: boolean;
}

export function useTapTempo(options?: UseTapTempoOptions): UseTapTempoReturn {
  const {
    onTempoDetected,
    minTaps = 3,
    maxTaps = 8,
    resetTimeout = 2000,
  } = options || {};

  const [tapCount, setTapCount] = useState(0);
  const [detectedTempo, setDetectedTempo] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);

  const tapTimesRef = useRef<number[]>([]);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const calculateTempo = useCallback((times: number[]): number | null => {
    if (times.length < 2) return null;

    // Calculate intervals between taps
    const intervals: number[] = [];
    for (let i = 1; i < times.length; i++) {
      intervals.push(times[i] - times[i - 1]);
    }

    // Average interval in ms
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Convert to BPM
    const tempo = Math.round(60000 / avgInterval);

    // Clamp to valid range
    if (tempo < MIN_TEMPO || tempo > MAX_TEMPO) return null;

    return tempo;
  }, []);

  const reset = useCallback(() => {
    tapTimesRef.current = [];
    setTapCount(0);
    setIsActive(false);
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const tap = useCallback(() => {
    const now = performance.now();

    // Clear any existing reset timer
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    // Add tap time
    tapTimesRef.current.push(now);
    setIsActive(true);

    // Keep only the last maxTaps
    if (tapTimesRef.current.length > maxTaps) {
      tapTimesRef.current = tapTimesRef.current.slice(-maxTaps);
    }

    const count = tapTimesRef.current.length;
    setTapCount(count);

    // Calculate tempo if we have enough taps
    if (count >= minTaps) {
      const tempo = calculateTempo(tapTimesRef.current);
      if (tempo !== null) {
        setDetectedTempo(tempo);
        onTempoDetected?.(tempo);
      }
    }

    // Set reset timer
    resetTimerRef.current = setTimeout(reset, resetTimeout);
  }, [minTaps, maxTaps, resetTimeout, calculateTempo, onTempoDetected, reset]);

  return {
    tap,
    reset,
    tapCount,
    detectedTempo,
    isActive,
  };
}
