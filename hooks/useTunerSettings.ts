import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { InstrumentId, isInstrumentId } from "@/utils/audio/instruments";
import { TunerMode } from "@/utils/audio/tuner";

const SETTINGS_KEY = "tuner_settings";

export type TunerSettings = {
  instrument: InstrumentId;
  mode: TunerMode;
};

const DEFAULT_SETTINGS: TunerSettings = { instrument: "guitar", mode: "strings" };

/** The tuner's instrument and mode, remembered across launches. */
export function useTunerSettings() {
  const [settings, setSettings] = useState<TunerSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const settingsRef = useRef(settings);
  const changedRef = useRef(false); // a choice made before loading finished wins

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SETTINGS_KEY)
      .then((json) => {
        if (!active || !json || changedRef.current) return;
        const saved = JSON.parse(json);
        const loaded: TunerSettings = {
          instrument: isInstrumentId(saved?.instrument) ? saved.instrument : DEFAULT_SETTINGS.instrument,
          mode: saved?.mode === "chromatic" ? "chromatic" : "strings",
        };
        settingsRef.current = loaded;
        setSettings(loaded);
      })
      .catch((error) => console.warn("Failed to load tuner settings:", error))
      .finally(() => {
        if (active) setIsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<TunerSettings>) => {
    changedRef.current = true;
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch((error) =>
      console.warn("Failed to save tuner settings:", error),
    );
  }, []);

  return { settings, isLoaded, updateSettings };
}
