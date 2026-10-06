import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import {
  MetronomeCircleBeats,
  MetronomePendulum,
  TempoControls,
  TimeSignaturePicker,
  SubdivisionPicker,
  FavoriteTempos,
  SettingsRow,
  DisplayRow,
} from "@/components/metronome";
import { useMetronome } from "@/hooks/useMetronome";
import { useTapTempo } from "@/hooks/useTapTempo";
import { useMetronomeStorage } from "@/hooks/useMetronomeStorage";
import { useDeviceScale } from "@/hooks/useDeviceScale";
import {
  DisplayMode,
  MetronomeSettings,
  TimeSignature,
  Subdivision,
} from "@/utils/metronome/types";
import { useColors } from "@/contexts/ThemeContext";
import ScreenBannerAd from "@/components/ads/ScreenBannerAd";

const SETTINGS_SAVE_DELAY_MS = 300;

export default function MetronomeScreen() {
  const { t } = useTranslation("common");
  const colors = useColors();
  const { scale } = useDeviceScale();
  const storage = useMetronomeStorage();
  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    storage.settings.displayMode
  );

  const metronome = useMetronome({
    tempo: storage.settings.tempo,
    timeSignature: storage.settings.timeSignature,
    subdivision: storage.settings.subdivision,
    soundEnabled: storage.settings.soundEnabled,
    hapticEnabled: storage.settings.hapticEnabled,
    accentFirstBeat: storage.settings.accentFirstBeat,
    displayMode: storage.settings.displayMode,
  });

  const tapTempo = useTapTempo({
    onTempoDetected: metronome.setTempo,
  });

  // Saves are debounced: dragging the tempo slider changes the tempo many times a second, and
  // each save is a storage write plus another render. Debouncing also drops the stale save of
  // the defaults this effect makes the moment loading finishes, before the stored settings
  // are applied below. Whatever is still pending is flushed on unmount.
  const saveSettingsRef = useRef(storage.saveSettings);
  saveSettingsRef.current = storage.saveSettings;
  const pendingSaveRef = useRef<Partial<MetronomeSettings> | null>(null);

  useEffect(() => {
    if (storage.isLoading) return;
    const settings: Partial<MetronomeSettings> = {
      tempo: metronome.tempo,
      timeSignature: metronome.timeSignature,
      subdivision: metronome.subdivision,
      soundEnabled: metronome.soundEnabled,
      hapticEnabled: metronome.hapticEnabled,
      accentFirstBeat: metronome.accentFirstBeat,
      displayMode,
    };
    pendingSaveRef.current = settings;
    const timer = setTimeout(() => {
      pendingSaveRef.current = null;
      saveSettingsRef.current(settings);
    }, SETTINGS_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [
    metronome.tempo,
    metronome.timeSignature,
    metronome.subdivision,
    metronome.soundEnabled,
    metronome.hapticEnabled,
    metronome.accentFirstBeat,
    displayMode,
    storage.isLoading,
  ]);

  useEffect(
    () => () => {
      if (pendingSaveRef.current) saveSettingsRef.current(pendingSaveRef.current);
    },
    []
  );

  useEffect(() => {
    if (!storage.isLoading) {
      metronome.setTempo(storage.settings.tempo);
      metronome.setTimeSignature(storage.settings.timeSignature);
      metronome.setSubdivision(storage.settings.subdivision);
      metronome.setSoundEnabled(storage.settings.soundEnabled);
      metronome.setHapticEnabled(storage.settings.hapticEnabled);
      metronome.setAccentFirstBeat(storage.settings.accentFirstBeat);
      setDisplayMode(storage.settings.displayMode);
    }
  }, [storage.isLoading]);

  // Depend on the individual (stable) setters, not the `metronome` object - that's new on
  // every beat, which re-rendered every control below the display while playing.
  const { setTimeSignature, setSubdivision, setTempo } = metronome;
  const { toggleFavoriteTempo, removeFavorite } = storage;

  const handleTimeSignatureChange = useCallback(
    (ts: TimeSignature) => {
      setTimeSignature(ts);
    },
    [setTimeSignature]
  );

  const handleSubdivisionChange = useCallback(
    (sub: Subdivision) => {
      setSubdivision(sub);
    },
    [setSubdivision]
  );

  const handleDisplayModeChange = useCallback((mode: DisplayMode) => {
    setDisplayMode(mode);
  }, []);

  const handleFavoriteSelect = useCallback(
    (tempo: number) => {
      setTempo(tempo);
    },
    [setTempo]
  );

  const currentTempo = metronome.tempo;
  const handleToggleFavorite = useCallback(() => {
    toggleFavoriteTempo(currentTempo);
  }, [toggleFavoriteTempo, currentTempo]);

  const handleRemoveFavorite = useCallback(
    (id: string) => {
      removeFavorite(id);
    },
    [removeFavorite]
  );

  if (storage.isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <AppText style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t("metronome.loading")}
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScreenBannerAd screen="metronome" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Display Mode (상단) */}
        <DisplayRow
          displayMode={displayMode}
          onDisplayModeChange={handleDisplayModeChange}
        />

        {/* Visual Display (여백 추가) */}
        <View style={[styles.displayArea, { minHeight: 260 * scale, paddingVertical: 32 * scale }]}>
          {displayMode === "circle" ? (
            <MetronomeCircleBeats
              beats={metronome.timeSignature.beats}
              currentBeat={metronome.currentBeat}
              isPlaying={metronome.isPlaying}
              accentFirstBeat={metronome.accentFirstBeat}
            />
          ) : (
            <MetronomePendulum
              tempo={metronome.tempo}
              isPlaying={metronome.isPlaying}
              currentBeat={metronome.currentBeat}
            />
          )}
        </View>

        {/* Tempo Controls (BPM + TAP 버튼) */}
        <TempoControls
          tempo={metronome.tempo}
          onTempoChange={metronome.setTempo}
          onTap={tapTempo.tap}
          tapCount={tapTempo.tapCount}
        />

        {/* Play/Pause Button */}
        <View style={styles.playButtonContainer}>
          <TouchableOpacity
            style={[
              styles.playButton,
              { backgroundColor: metronome.isPlaying ? colors.primary : colors.surface },
            ]}
            onPress={metronome.toggle}
          >
            <Ionicons
              name={metronome.isPlaying ? "pause" : "play"}
              size={40}
              color="#fff"
            />
            <AppText style={styles.playButtonText}>
              {metronome.isPlaying ? t("metronome.pause") : t("metronome.play")}
            </AppText>
          </TouchableOpacity>
        </View>

        {/* Settings Row (Sound, Haptic, Accent) - 재생 버튼 아래 */}
        <SettingsRow
          soundEnabled={metronome.soundEnabled}
          hapticEnabled={metronome.hapticEnabled}
          accentFirstBeat={metronome.accentFirstBeat}
          onSoundEnabledChange={metronome.setSoundEnabled}
          onHapticEnabledChange={metronome.setHapticEnabled}
          onAccentFirstBeatChange={metronome.setAccentFirstBeat}
        />

        {/* Favorites - Time/Beat 위에 배치 */}
        <FavoriteTempos
          favorites={storage.favorites}
          currentTempo={metronome.tempo}
          isFavorite={storage.isFavoriteTempo(metronome.tempo)}
          onSelect={handleFavoriteSelect}
          onToggleFavorite={handleToggleFavorite}
          onRemove={handleRemoveFavorite}
        />

        {/* Time Signature */}
        <TimeSignaturePicker
          selected={metronome.timeSignature}
          onSelect={handleTimeSignatureChange}
        />

        {/* Subdivision */}
        <SubdivisionPicker
          selected={metronome.subdivision}
          onSelect={handleSubdivisionChange}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32, // 탭바 위 충분한 여백
  },
  displayArea: {
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
    borderRadius: 16,
  },
  playButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
});
