import AppText from "@/components/AppText";
import { useColors } from "@/contexts/ThemeContext";
import { useMicrophonePermission } from "@/hooks/useMicrophonePermission";
import { useDeviceScale } from "@/hooks/useDeviceScale";
import { useTunerSettings } from "@/hooks/useTunerSettings";
import { INSTRUMENT_IDS, INSTRUMENTS, InstrumentId } from "@/utils/audio/instruments";
import {
  LOCK_ENTER_CENTS,
  SILENCE_THRESHOLD,
  TunerEngine,
  TunerMode,
  TunerReading,
} from "@/utils/audio/tuner";
import { useFocusEffect } from "@react-navigation/native";
import ExpoPcmStream, { type PitchEvent } from "expo-pcm-stream";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  AppState,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Dimensions,
  Platform,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path, Circle, Line, Text as SvgText } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenBannerAd from "@/components/ads/ScreenBannerAd";

type Info = Omit<TunerReading, "targetHz">;

// ===== DSP params (detection itself runs natively in expo-pcm-stream) =====
const HOP = 1024;
const MAX_CENTS_UI = 50;
const UI_INTERVAL = 50;

// The needle sweeps +-45 degrees for +-50 cents, magnified around the center: the last few
// cents are what tuning is about, and on a linear scale 1 cent is under a degree.
const GAUGE_EXPONENT = 0.6; // 1 cent -> 4.3 deg, 3 cents -> 8.3 deg, 10 -> 17 deg, 50 -> 45 deg
const GAUGE_TICKS = [-50, -40, -30, -20, -10, -5, 0, 5, 10, 20, 30, 40, 50];
const NEEDLE_SPRING = { damping: 15, stiffness: 100 };

const SCREEN_WIDTH = Dimensions.get("window").width;
const BASE_GAUGE_SIZE = Math.min(SCREEN_WIDTH - 48, 320);

const EMPTY_INFO: Info = { locked: false };

const centsToAngle = (cents: number) => {
  const clamped = Math.max(-MAX_CENTS_UI, Math.min(MAX_CENTS_UI, cents));
  return Math.sign(clamped) * 45 * Math.pow(Math.abs(clamped) / MAX_CENTS_UI, GAUGE_EXPONENT);
};

// What the screen shows: Hz to 0.01 below 100 Hz (0.1 Hz is ~2-4 cents down there) and to 0.1
// above, cents to 0.1. Comparing these (rather than the raw readings) lets a held note or
// silence skip re-rendering entirely.
const roundHz = (hz: number) => (hz < 100 ? Math.round(hz * 100) / 100 : Math.round(hz * 10) / 10);
const formatHz = (hz: number) => hz.toFixed(hz < 100 ? 2 : 1);
const formatCents = (cents: number) => {
  const text = Math.abs(cents) < 100 ? cents.toFixed(1) : cents.toFixed(0);
  return cents > 0 ? `+${text}` : text;
};

const toDisplayInfo = (info: TunerReading): Info => ({
  hz: info.hz != null ? roundHz(info.hz) : undefined,
  note: info.note,
  octave: info.octave,
  cents: info.cents != null ? Math.round(info.cents * 10) / 10 : undefined,
  stringNumber: info.stringNumber,
  locked: info.locked,
});

const sameDisplayInfo = (a: Info, b: Info) =>
  a.hz === b.hz &&
  a.note === b.note &&
  a.octave === b.octave &&
  a.cents === b.cents &&
  a.locked === b.locked &&
  a.stringNumber === b.stringNumber;

const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

// Generate arc path for gauge
const createArcPath = (
  gaugeSize: number,
  startAngle: number,
  endAngle: number,
  radius: number
) => {
  const cx = gaugeSize / 2;
  const cy = gaugeSize / 2;
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

export default function TunerScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { scale } = useDeviceScale();
  const { status, isLoading, isBlocked, checkPermission, requestPermission, openSettings } =
    useMicrophonePermission();
  // iOS asks for the permission itself when the stream starts; Android needs it granted first.
  const needsPermission = Platform.OS === "android" ? status !== "granted" : isBlocked;

  const { settings, isLoaded: settingsLoaded, updateSettings } = useTunerSettings();
  const instrument = INSTRUMENTS[settings.instrument];
  const mode = settings.mode;
  // A string tapped to tune it regardless of what's detected (null: automatic).
  const [pinnedString, setPinnedString] = useState<number | null>(null);

  // 스케일된 사이즈
  const sizes = useMemo(() => {
    const gaugeSize = BASE_GAUGE_SIZE * scale;
    return {
      gaugeSize,
      gaugeRadius: gaugeSize / 2 - 20 * scale,
      noteSize: 72 * scale,
      octaveSize: 32 * scale,
      centsSize: 32 * scale,
      hzSize: 16 * scale,
      stringWidth: 44 * scale,
      stringHeight: 56 * scale,
      needleHeight: (gaugeSize / 2 - 20 * scale) - 20,
    };
  }, [scale]);

  // Animation values
  const needleRotation = useSharedValue(0);
  const noteScale = useSharedValue(1);
  const lockedProgress = useSharedValue(0);

  // ===== Detection state =====
  const engineRef = useRef<TunerEngine | null>(null);
  if (engineRef.current == null) engineRef.current = new TunerEngine(instrument, mode);
  const rangeRef = useRef(instrument.stringRange);

  // ===== Performance refs =====
  const lastUiUpdateRef = useRef(0);
  const pendingInfoRef = useRef<TunerReading>(EMPTY_INFO);
  const shownInfoRef = useRef<Info>(EMPTY_INFO);
  const needleAngleRef = useRef(0);

  const [info, setInfo] = useState<Info>(EMPTY_INFO);

  const setNeedle = useCallback(
    (cents: number) => {
      const angle = centsToAngle(cents);
      if (Math.abs(angle - needleAngleRef.current) < 0.05) return;
      needleAngleRef.current = angle;
      // Animated on the UI thread
      needleRotation.value = withSpring(angle, NEEDLE_SPRING);
    },
    [needleRotation]
  );

  const resetDisplay = useCallback(() => {
    pendingInfoRef.current = EMPTY_INFO;
    shownInfoRef.current = EMPTY_INFO;
    setInfo(EMPTY_INFO);
    setNeedle(0);
  }, [setNeedle]);

  // Instrument or mode changed: retarget detection. The range switches in place; a different
  // analysis window restarts the stream (the focus effect below depends on it).
  useEffect(() => {
    engineRef.current!.configure(instrument, mode);
    setPinnedString(null);
    const range = mode === "strings" ? instrument.stringRange : instrument.chromaticRange;
    rangeRef.current = range;
    ExpoPcmStream.setFrequencyRange(range.minFrequency, range.maxFrequency);
    resetDisplay();
  }, [instrument, mode, resetDisplay]);

  // Locked state animation (the needle is driven directly from the pitch events)
  useEffect(() => {
    if (info.locked) {
      lockedProgress.value = withTiming(1, { duration: 200 });
      noteScale.value = withSpring(1.1, { damping: 10 });
    } else {
      lockedProgress.value = withTiming(0, { duration: 200 });
      noteScale.value = withSpring(1, { damping: 10 });
    }
  }, [info.locked]);

  const windowSize = instrument.windowSize;
  useFocusEffect(
    useCallback(() => {
      // Android에서 권한이 없으면 시작하지 않음 (iOS는 시작 시 네이티브가 직접 요청)
      // Also wait for the saved instrument, so a bass doesn't start on the guitar's window.
      if (needsPermission || !settingsLoaded) {
        return;
      }

      const maybeUpdateUi = (now: number) => {
        if (now - lastUiUpdateRef.current < UI_INTERVAL) return;
        lastUiUpdateRef.current = now;
        setNeedle(pendingInfoRef.current.cents ?? 0);
        const next = toDisplayInfo(pendingInfoRef.current);
        if (!sameDisplayInfo(next, shownInfoRef.current)) {
          shownInfoRef.current = next;
          setInfo(next);
        }
      };

      const processPitch = (event: PitchEvent) => {
        const now = Date.now();
        pendingInfoRef.current = engineRef.current!.process(event, now);
        maybeUpdateUi(now);
      };

      const pitchSub = ExpoPcmStream.addListener("onPitch", processPitch);
      const errorSub = ExpoPcmStream.addListener("onPitchStreamError", (error) => {
        console.warn("Tuner audio stopped:", error.message);
      });

      let running = false;
      const start = () => {
        if (running) return;
        running = true;
        ExpoPcmStream.start({
          windowSize,
          hopSize: HOP,
          silenceThreshold: SILENCE_THRESHOLD,
          ...rangeRef.current,
        }).catch((error) => {
          running = false;
          if (error?.code === "ERR_MIC_PERMISSION") {
            checkPermission(); // shows the permission screen once it reports "blocked"
          } else {
            console.warn("Failed to start the tuner:", error);
          }
        });
      };
      const stop = () => {
        if (!running) return;
        running = false;
        ExpoPcmStream.stop().catch(() => {});
        engineRef.current!.reset();
        resetDisplay();
      };

      if (AppState.currentState !== "background") {
        start();
      }
      // Release the mic while the app is in the background: iOS would suspend it anyway, and
      // Android would keep recording (silence) and analyzing it, draining the battery.
      const appStateSub = AppState.addEventListener("change", (state) => {
        if (state === "active") start();
        else if (state === "background") stop();
      });

      return () => {
        appStateSub.remove();
        pitchSub.remove();
        errorSub.remove();
        stop();
      };
    }, [needsPermission, settingsLoaded, windowSize, checkPermission, setNeedle, resetDisplay]),
  );

  const selectInstrument = (id: InstrumentId) => {
    if (id !== settings.instrument) updateSettings({ instrument: id });
  };

  const selectMode = (next: TunerMode) => {
    if (next !== mode) updateSettings({ mode: next });
  };

  const pinString = (stringNumber: number | null) => {
    setPinnedString(stringNumber);
    engineRef.current!.pinString(stringNumber);
  };

  // Keep the selected instrument in view: the row scrolls on narrow screens and long names.
  const instrumentScrollRef = useRef<ScrollView>(null);
  const instrumentLayoutsRef = useRef<Partial<Record<InstrumentId, { x: number; width: number }>>>({});
  const instrumentScrollWidthRef = useRef(0);
  const instrumentContentWidthRef = useRef(0);
  const scrollToInstrument = useCallback((id: InstrumentId, animated: boolean) => {
    const layout = instrumentLayoutsRef.current[id];
    const viewWidth = instrumentScrollWidthRef.current;
    const maxX = instrumentContentWidthRef.current - viewWidth;
    if (!layout || viewWidth <= 0 || maxX <= 0) return;
    const x = layout.x + layout.width / 2 - viewWidth / 2;
    instrumentScrollRef.current?.scrollTo({ x: Math.max(0, Math.min(maxX, x)), animated });
  }, []);
  useEffect(() => {
    scrollToInstrument(settings.instrument, true);
  }, [settings.instrument, scrollToInstrument]);

  const noteAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: noteScale.value }],
  }));

  const needleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${needleRotation.value}deg` }],
  }));

  // Static part of the gauge, so pitch updates only re-render what actually changes.
  const gaugeBackground = useMemo(
    () => (
      <>
        {/* Background arc */}
        <Path
          d={createArcPath(sizes.gaugeSize, -90, 90, sizes.gaugeRadius)}
          stroke={colors.surface}
          strokeWidth={8 * scale}
          fill="none"
          strokeLinecap="round"
        />

        {/* IN TUNE zone */}
        <Path
          d={createArcPath(
            sizes.gaugeSize,
            centsToAngle(-LOCK_ENTER_CENTS),
            centsToAngle(LOCK_ENTER_CENTS),
            sizes.gaugeRadius
          )}
          stroke={colors.primary}
          strokeOpacity={0.45}
          strokeWidth={8 * scale}
          fill="none"
        />

        {/* Tick marks at true cent values, placed on the magnified scale */}
        {GAUGE_TICKS.map((cents) => {
          const angle = centsToAngle(cents);
          const isCenter = cents === 0;
          const isMajor = cents % 50 === 0 || Math.abs(cents) === 10;
          const length = isCenter ? 20 : isMajor ? 14 : 10;
          const innerR = sizes.gaugeRadius - length * scale;
          const outerR = sizes.gaugeRadius - 4 * scale;
          const cx = sizes.gaugeSize / 2;
          const cy = sizes.gaugeSize / 2;
          const start = polarToCartesian(cx, cy, innerR, angle);
          const end = polarToCartesian(cx, cy, outerR, angle);
          return (
            <Line
              key={cents}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={isCenter ? colors.primary : colors.textSecondary}
              strokeWidth={isCenter ? 3 * scale : isMajor ? 2 * scale : 1.5 * scale}
            />
          );
        })}
      </>
    ),
    [sizes, scale, colors.surface, colors.primary, colors.textSecondary]
  );

  const gaugeColor = info.locked ? colors.primary : "#fff";
  const centsValue = info.cents ?? 0;
  const isFlat = centsValue < -LOCK_ENTER_CENTS;
  const isSharp = centsValue > LOCK_ENTER_CENTS;

  // 권한이 필요한 경우 권한 요청 화면 표시 (iOS는 한 번 거부하면 설정 앱에서만 허용 가능)
  if (!isLoading && needsPermission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.permissionContainer}>
          <AppText style={[styles.permissionTitle, { color: colors.text }]}>
            마이크 권한 필요
          </AppText>
          <AppText
            style={[styles.permissionText, { color: colors.textSecondary }]}
          >
            튜너 기능을 사용하려면{"\n"}마이크 권한이 필요합니다.
          </AppText>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: colors.primary }]}
            onPress={isBlocked ? openSettings : requestPermission}
          >
            <AppText style={styles.permissionButtonText}>
              {isBlocked ? "설정에서 권한 허용" : "권한 허용하기"}
            </AppText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <ScreenBannerAd screen="tuner" />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
      {/* Instrument */}
      <ScrollView
        ref={instrumentScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.instrumentScroll}
        contentContainerStyle={[styles.instrumentRow, { gap: 8 * scale }]}
        onLayout={(e: LayoutChangeEvent) => {
          instrumentScrollWidthRef.current = e.nativeEvent.layout.width;
          scrollToInstrument(settings.instrument, false);
        }}
        onContentSizeChange={(width) => {
          instrumentContentWidthRef.current = width;
          scrollToInstrument(settings.instrument, false);
        }}
      >
        {INSTRUMENT_IDS.map((id) => {
          const selected = id === settings.instrument;
          return (
            <TouchableOpacity
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => selectInstrument(id)}
              onLayout={(e: LayoutChangeEvent) => {
                const { x, width } = e.nativeEvent.layout;
                instrumentLayoutsRef.current[id] = { x, width };
                if (selected) scrollToInstrument(id, false);
              }}
              style={[
                styles.instrumentButton,
                {
                  paddingHorizontal: 14 * scale,
                  paddingVertical: 8 * scale,
                  borderRadius: 18 * scale,
                  backgroundColor: selected ? colors.primary : colors.surface,
                },
              ]}
            >
              <AppText
                style={[
                  styles.instrumentText,
                  { fontSize: 13 * scale, color: selected ? "#fff" : colors.textSecondary },
                ]}
              >
                {t(`tuner.instruments.${id}`)}
              </AppText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Mode Toggle */}
      <View style={[styles.modeToggle, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.modeButton,
            mode === "strings" && { backgroundColor: colors.primary },
          ]}
          onPress={() => selectMode("strings")}
        >
          <AppText
            style={[
              styles.modeText,
              { color: mode === "strings" ? "#fff" : colors.textSecondary },
            ]}
          >
            STANDARD
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modeButton,
            mode === "chromatic" && { backgroundColor: colors.primary },
          ]}
          onPress={() => selectMode("chromatic")}
        >
          <AppText
            style={[
              styles.modeText,
              { color: mode === "chromatic" ? "#fff" : colors.textSecondary },
            ]}
          >
            CHROMATIC
          </AppText>
        </TouchableOpacity>
      </View>

      {/* Semicircular Gauge */}
      <View style={[styles.gaugeContainer, { width: sizes.gaugeSize, height: sizes.gaugeSize / 2 + 50 }]}>
        <Svg width={sizes.gaugeSize} height={sizes.gaugeSize / 2 + 40}>
          {gaugeBackground}

          {/* Labels */}
          <SvgText
            x={sizes.gaugeSize / 2 - sizes.gaugeRadius + 10 * scale}
            y={sizes.gaugeSize / 2 + 25 * scale}
            fill={isFlat ? colors.red : colors.textSecondary}
            fontSize={14 * scale}
            fontWeight={isFlat ? "700" : "400"}
            textAnchor="middle"
          >
            FLAT
          </SvgText>
          <SvgText
            x={sizes.gaugeSize / 2 + sizes.gaugeRadius - 10 * scale}
            y={sizes.gaugeSize / 2 + 25 * scale}
            fill={isSharp ? colors.yellow : colors.textSecondary}
            fontSize={14 * scale}
            fontWeight={isSharp ? "700" : "400"}
            textAnchor="middle"
          >
            SHARP
          </SvgText>

          {/* Center indicator when locked */}
          {info.locked && (
            <Circle
              cx={sizes.gaugeSize / 2}
              cy={sizes.gaugeSize / 2 - sizes.gaugeRadius + 4 * scale}
              r={8 * scale}
              fill={colors.primary}
            />
          )}
        </Svg>

        {/* Needle */}
        <Animated.View
          style={[
            styles.needleContainer,
            { bottom: 30 * scale },
            needleAnimatedStyle,
          ]}
        >
          <View style={[styles.needle, { width: 4 * scale, height: sizes.needleHeight, backgroundColor: gaugeColor }]} />
          <View style={[styles.needleBase, { width: 16 * scale, height: 16 * scale, borderRadius: 8 * scale, backgroundColor: gaugeColor }]} />
        </Animated.View>
      </View>

      {/* Note Display */}
      <View style={styles.noteContainer}>
        <Animated.View style={noteAnimatedStyle}>
          <AppText
            style={[
              styles.note,
              { fontSize: sizes.noteSize, color: info.locked ? colors.primary : colors.text },
            ]}
          >
            {info.note ?? "-"}
            {info.octave !== undefined && (
              <AppText style={[styles.octave, { fontSize: sizes.octaveSize }]}>{info.octave}</AppText>
            )}
          </AppText>
        </Animated.View>

        {/* Always laid out, so locking doesn't shift everything below it */}
        <View
          accessibilityElementsHidden={!info.locked}
          importantForAccessibility={info.locked ? "auto" : "no-hide-descendants"}
          style={[
            styles.lockedBadge,
            {
              opacity: info.locked ? 1 : 0,
              backgroundColor: colors.primary,
              paddingHorizontal: 16 * scale,
              paddingVertical: 6 * scale,
            },
          ]}
        >
          <AppText style={[styles.lockedText, { fontSize: 12 * scale }]}>IN TUNE</AppText>
        </View>
      </View>

      {/* Frequency Display */}
      <AppText style={[styles.hz, { fontSize: sizes.hzSize, color: colors.textSecondary }]}>
        {info.hz ? `${formatHz(info.hz)} Hz` : "---"}
      </AppText>

      {/* Cents Display */}
      <View style={styles.centsContainer}>
        <AppText
          style={[
            styles.cents,
            {
              fontSize: sizes.centsSize,
              color: info.locked
                ? colors.primary
                : isFlat
                ? colors.red
                : isSharp
                ? colors.yellow
                : colors.text,
            },
          ]}
        >
          {info.cents != null ? formatCents(info.cents) : "0.0"}
        </AppText>
        <AppText style={[styles.centsLabel, { fontSize: 14 * scale, color: colors.textSecondary }]}>
          cents
        </AppText>
      </View>

      {/* Strings (Standard Mode Only): tap one to tune it no matter what's detected */}
      {mode === "strings" && (
        <View style={[styles.stringsArea, { marginTop: 20 * scale }]}>
          <View style={[styles.stringsContainer, { gap: 12 * scale }]}>
            {instrument.strings.map((string) => {
              const isPinned = pinnedString === string.number;
              const isActive = info.stringNumber === string.number;
              return (
                <TouchableOpacity
                  key={string.number}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isPinned }}
                  onPress={() => pinString(isPinned ? null : string.number)}
                  style={[
                    styles.stringIndicator,
                    {
                      width: sizes.stringWidth,
                      height: sizes.stringHeight,
                      borderRadius: 8 * scale,
                      backgroundColor: isActive
                        ? colors.primary
                        : isPinned
                        ? colors.primaryLight
                        : colors.surface,
                      borderColor: isPinned || isActive ? colors.primary : "transparent",
                    },
                  ]}
                >
                  <AppText
                    style={[
                      styles.stringText,
                      { fontSize: 18 * scale, color: isActive ? "#fff" : isPinned ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {string.name}
                  </AppText>
                  <AppText
                    style={[
                      styles.stringNumber,
                      { fontSize: 10 * scale, color: isActive ? "#fff" : isPinned ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {string.number}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: pinnedString == null }}
            onPress={() => pinString(null)}
            style={[
              styles.autoButton,
              {
                marginTop: 10 * scale,
                paddingHorizontal: 12 * scale,
                paddingVertical: 4 * scale,
                borderRadius: 12 * scale,
                borderColor: pinnedString == null ? colors.primary : colors.border,
                backgroundColor: pinnedString == null ? colors.primaryLight : "transparent",
              },
            ]}
          >
            <AppText
              style={[
                styles.autoText,
                { fontSize: 11 * scale, color: pinnedString == null ? colors.primary : colors.textSecondary },
              ]}
            >
              AUTO
            </AppText>
          </TouchableOpacity>
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionContainer: {
    alignItems: "center",
    padding: 24,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  instrumentScroll: {
    alignSelf: "stretch",
    flexGrow: 0,
    marginHorizontal: -24, // scroll edge to edge, past the container's padding
    marginBottom: 12,
  },
  instrumentRow: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  instrumentButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  instrumentText: {
    fontWeight: "600",
  },
  modeToggle: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  modeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modeText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
  },
  gaugeContainer: {
    alignItems: "center",
    justifyContent: "flex-start",
    position: "relative",
  },
  needleContainer: {
    position: "absolute",
    alignItems: "center",
    transformOrigin: "center bottom",
  },
  needle: {
    borderRadius: 2,
  },
  needleBase: {
    marginTop: -4,
  },
  noteContainer: {
    alignItems: "center",
    marginTop: 8,
    minHeight: 100,
  },
  note: {
    fontWeight: "800",
  },
  octave: {
    fontWeight: "600",
  },
  lockedBadge: {
    borderRadius: 20,
    marginTop: 8,
  },
  lockedText: {
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 1,
  },
  hz: {
    marginTop: 8,
  },
  centsContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 4,
  },
  cents: {
    fontWeight: "700",
  },
  centsLabel: {
    marginLeft: 4,
  },
  stringsArea: {
    alignItems: "center",
  },
  stringsContainer: {
    flexDirection: "row",
  },
  stringIndicator: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  stringText: {
    fontWeight: "700",
  },
  stringNumber: {
    marginTop: 2,
  },
  autoButton: {
    borderWidth: 1,
  },
  autoText: {
    fontWeight: "700",
    letterSpacing: 1,
  },
});
