import AppText from "@/components/AppText";
import { useColors } from "@/contexts/ThemeContext";
import { useMicrophonePermission } from "@/hooks/useMicrophonePermission";
import { useDeviceScale } from "@/hooks/useDeviceScale";
import {
  nearestChromaticTarget,
  nearestGuitarTarget,
} from "@/utils/audio/guitar";
import { PitchTracker } from "@/utils/audio/pitch";
import { useFocusEffect } from "@react-navigation/native";
import ExpoPcmStream, { type PitchEvent } from "expo-pcm-stream";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { AppState, StyleSheet, TouchableOpacity, View, Dimensions, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import Svg, { Path, Circle, Line, Text as SvgText } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenBannerAd from "@/components/ads/ScreenBannerAd";

type Info = {
  hz?: number;
  note?: string;
  octave?: number;
  cents?: number;
  locked?: boolean;
  guitarString?: number;
};

// ===== DSP params (detection itself runs natively in expo-pcm-stream) =====
const HOP = 1024;
const WINDOW = 2048;
const MAX_CENTS_UI = 50;
const GATE = 0.002;
const FADE_OUT_MS = 300;
const LOCK_CENTS = 10;
const LOCK_MS = 400;
const LOCK_MIN_CLARITY = 0.8; // require a confident detection before showing "in tune"
const SWITCH_CENTS = 35;
const UI_INTERVAL = 50;

// Standard mode is deliberately narrow (tailored to guitar + margin for detuning).
// Chromatic mode needs to cover any note - the old fixed 70-400Hz range couldn't even
// detect a ukulele's open A string (440Hz) or a guitar's high frets.
const STANDARD_MIN_FREQ = 70;
const STANDARD_MAX_FREQ = 400;
const CHROMATIC_MIN_FREQ = 65;
const CHROMATIC_MAX_FREQ = 1500;

const SCREEN_WIDTH = Dimensions.get("window").width;
const BASE_GAUGE_SIZE = Math.min(SCREEN_WIDTH - 48, 320);

// 기타 줄 이름
const GUITAR_STRINGS = ["E", "A", "D", "G", "B", "E"];

const frequencyRange = (standardMode: boolean) =>
  standardMode
    ? { minFrequency: STANDARD_MIN_FREQ, maxFrequency: STANDARD_MAX_FREQ }
    : { minFrequency: CHROMATIC_MIN_FREQ, maxFrequency: CHROMATIC_MAX_FREQ };

// What the screen shows: Hz to 0.1, cents to whole numbers. Comparing these (rather than the raw
// readings) lets a held note or silence skip re-rendering entirely.
const toDisplayInfo = (info: Info): Info => ({
  hz: info.hz != null ? Math.round(info.hz * 10) / 10 : undefined,
  note: info.note,
  octave: info.octave,
  cents: info.cents != null ? Math.round(info.cents) : undefined,
  locked: info.locked ?? false,
  guitarString: info.guitarString,
});

const sameDisplayInfo = (a: Info, b: Info) =>
  a.hz === b.hz &&
  a.note === b.note &&
  a.octave === b.octave &&
  a.cents === b.cents &&
  a.locked === b.locked &&
  a.guitarString === b.guitarString;

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
  const { scale, isTablet } = useDeviceScale();
  const { status, isLoading, isBlocked, checkPermission, requestPermission, openSettings } =
    useMicrophonePermission();
  // iOS asks for the permission itself when the stream starts; Android needs it granted first.
  const needsPermission = Platform.OS === "android" ? status !== "granted" : isBlocked;

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

  // ===== DSP refs =====
  const pitchTrackerRef = useRef(new PitchTracker());
  const targetRef = useRef<{
    name: string;
    freq: number;
    string: number;
  } | null>(null);
  const lockSinceRef = useRef<number | null>(null);
  const lastNoteRef = useRef<string | null>(null);
  const silentSinceRef = useRef<number | null>(null);

  // ===== Performance refs =====
  const lastUiUpdateRef = useRef(0);
  const pendingInfoRef = useRef<Info>({});
  const shownInfoRef = useRef<Info>({});
  const needleCentsRef = useRef(0);

  const [info, setInfo] = useState<Info>({});
  const [isStandardMode, setIsStandardMode] = useState(true);
  const modeRef = useRef(true);

  useEffect(() => {
    modeRef.current = isStandardMode;
    // Switches the native detection range in place - no audio restart.
    const { minFrequency, maxFrequency } = frequencyRange(isStandardMode);
    ExpoPcmStream.setFrequencyRange(minFrequency, maxFrequency);
    targetRef.current = null;
    silentSinceRef.current = null;
    lockSinceRef.current = null;
    lastNoteRef.current = null;
    pitchTrackerRef.current.reset();
  }, [isStandardMode]);

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

  useFocusEffect(
    useCallback(() => {
      // Android에서 권한이 없으면 시작하지 않음 (iOS는 시작 시 네이티브가 직접 요청)
      if (needsPermission) {
        return;
      }

      const setNeedle = (cents: number) => {
        const clamped = Math.max(-MAX_CENTS_UI, Math.min(MAX_CENTS_UI, cents));
        if (Math.abs(clamped - needleCentsRef.current) < 0.05) return;
        needleCentsRef.current = clamped;
        // Needle rotation: -45 to +45 degrees, animated on the UI thread
        needleRotation.value = withSpring((clamped / MAX_CENTS_UI) * 45, {
          damping: 15,
          stiffness: 100,
        });
      };

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

      const resetDetection = () => {
        pitchTrackerRef.current.reset();
        targetRef.current = null;
        silentSinceRef.current = null;
        lockSinceRef.current = null;
        lastNoteRef.current = null;
        pendingInfoRef.current = {};
        shownInfoRef.current = {};
        setInfo({});
        setNeedle(0);
      };

      const processPitch = ({ frequency, clarity, rms }: PitchEvent) => {
        const now = Date.now();

        if (rms < GATE) {
          if (silentSinceRef.current === null) {
            silentSinceRef.current = now;
          }

          const silentDuration = now - silentSinceRef.current;

          if (silentDuration >= FADE_OUT_MS) {
            pendingInfoRef.current = {};
            pitchTrackerRef.current.reset();
            targetRef.current = null;
            lockSinceRef.current = null;
          } else {
            pendingInfoRef.current = {
              ...pendingInfoRef.current,
              locked: false,
            };
          }
          maybeUpdateUi(now);
          return;
        }

        silentSinceRef.current = null;

        const smoothedHz = pitchTrackerRef.current.update(frequency);
        if (!smoothedHz) return;

        let noteName: string;
        let cents: number;
        let guitarString: number | undefined;
        let octave: number | undefined;

        if (modeRef.current) {
          const nearest = nearestGuitarTarget(smoothedHz);

          if (!targetRef.current) {
            targetRef.current = {
              name: nearest.name,
              freq: nearest.freq,
              string: nearest.string,
            };
          } else {
            const curr = targetRef.current;
            const currCents = 1200 * Math.log2(smoothedHz / curr.freq);
            if (Math.abs(nearest.cents) + SWITCH_CENTS < Math.abs(currCents)) {
              targetRef.current = {
                name: nearest.name,
                freq: nearest.freq,
                string: nearest.string,
              };
            }
          }

          const target = targetRef.current!;
          cents = 1200 * Math.log2(smoothedHz / target.freq);
          noteName = target.name;
          guitarString = target.string;
        } else {
          const chromatic = nearestChromaticTarget(smoothedHz);
          noteName = chromatic.name.replace(/\d+$/, "");
          octave = parseInt(chromatic.name.match(/\d+$/)?.[0] ?? "4");
          cents = chromatic.cents;
          targetRef.current = null;
        }

        // Only a fresh, confident detection may advance or reset the lock timer - a
        // single transient miss (frequency == null, still showing the held smoothedHz)
        // just holds whatever lock state was already in progress instead of flickering.
        if (frequency != null && clarity >= LOCK_MIN_CLARITY) {
          const inTune = Math.abs(cents) <= LOCK_CENTS;
          if (inTune) {
            if (lastNoteRef.current !== noteName) {
              lastNoteRef.current = noteName;
              lockSinceRef.current = now;
            } else if (lockSinceRef.current == null) {
              lockSinceRef.current = now;
            }
          } else {
            lastNoteRef.current = noteName;
            lockSinceRef.current = null;
          }
        }

        const locked =
          lockSinceRef.current != null && now - lockSinceRef.current >= LOCK_MS;
        pendingInfoRef.current = {
          hz: smoothedHz,
          note: noteName,
          octave,
          cents,
          locked,
          guitarString,
        };
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
          windowSize: WINDOW,
          hopSize: HOP,
          silenceThreshold: GATE,
          ...frequencyRange(modeRef.current),
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
        resetDetection();
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
    }, [needsPermission, checkPermission, needleRotation]),
  );

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

        {/* Tick marks */}
        {[-45, -30, -15, 0, 15, 30, 45].map((angle, i) => {
          const isMajor = angle === 0;
          const innerR = sizes.gaugeRadius - (isMajor ? 20 * scale : 12 * scale);
          const outerR = sizes.gaugeRadius - 4 * scale;
          const cx = sizes.gaugeSize / 2;
          const cy = sizes.gaugeSize / 2;
          const start = polarToCartesian(cx, cy, innerR, angle);
          const end = polarToCartesian(cx, cy, outerR, angle);
          return (
            <Line
              key={i}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={angle === 0 ? colors.primary : colors.textSecondary}
              strokeWidth={isMajor ? 3 * scale : 2 * scale}
            />
          );
        })}
      </>
    ),
    [sizes, scale, colors.surface, colors.primary, colors.textSecondary]
  );

  const gaugeColor = info.locked ? colors.primary : "#fff";
  const centsValue = info.cents ?? 0;
  const isFlat = centsValue < -2;
  const isSharp = centsValue > 2;

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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Mode Toggle */}
      <View style={[styles.modeToggle, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[
            styles.modeButton,
            isStandardMode && { backgroundColor: colors.primary },
          ]}
          onPress={() => setIsStandardMode(true)}
        >
          <AppText
            style={[
              styles.modeText,
              { color: isStandardMode ? "#fff" : colors.textSecondary },
            ]}
          >
            STANDARD
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modeButton,
            !isStandardMode && { backgroundColor: colors.primary },
          ]}
          onPress={() => setIsStandardMode(false)}
        >
          <AppText
            style={[
              styles.modeText,
              { color: !isStandardMode ? "#fff" : colors.textSecondary },
            ]}
          >
            CHROMATIC
          </AppText>
        </TouchableOpacity>
      </View>

      {/* Semicircular Gauge */}
      <View style={[styles.gaugeContainer, { width: sizes.gaugeSize, height: sizes.gaugeSize / 2 + 60 }]}>
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
            {!isStandardMode && info.octave !== undefined && (
              <AppText style={[styles.octave, { fontSize: sizes.octaveSize }]}>{info.octave}</AppText>
            )}
          </AppText>
        </Animated.View>

        {info.locked && (
          <View style={[styles.lockedBadge, { backgroundColor: colors.primary, paddingHorizontal: 16 * scale, paddingVertical: 6 * scale }]}>
            <AppText style={[styles.lockedText, { fontSize: 12 * scale }]}>IN TUNE</AppText>
          </View>
        )}
      </View>

      {/* Frequency Display */}
      <AppText style={[styles.hz, { fontSize: sizes.hzSize, color: colors.textSecondary }]}>
        {info.hz ? `${info.hz.toFixed(1)} Hz` : "---"}
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
          {info.cents != null
            ? `${info.cents > 0 ? "+" : ""}${info.cents.toFixed(0)}`
            : "0"}
        </AppText>
        <AppText style={[styles.centsLabel, { fontSize: 14 * scale, color: colors.textSecondary }]}>
          cents
        </AppText>
      </View>

      {/* Guitar Strings (Standard Mode Only) */}
      {isStandardMode && (
        <View style={[styles.stringsContainer, { gap: 12 * scale, marginTop: 32 * scale }]}>
          {GUITAR_STRINGS.map((str, i) => {
            const stringNum = 6 - i;
            const isActive = info.guitarString === stringNum;
            return (
              <View
                key={i}
                style={[
                  styles.stringIndicator,
                  {
                    width: sizes.stringWidth,
                    height: sizes.stringHeight,
                    borderRadius: 8 * scale,
                    backgroundColor: isActive ? colors.primary : colors.surface,
                    borderColor: isActive ? colors.primary : "transparent",
                  },
                ]}
              >
                <AppText
                  style={[
                    styles.stringText,
                    { fontSize: 18 * scale, color: isActive ? "#fff" : colors.textSecondary },
                  ]}
                >
                  {str}
                </AppText>
                <AppText
                  style={[
                    styles.stringNumber,
                    { fontSize: 10 * scale, color: isActive ? "#fff" : colors.textSecondary },
                  ]}
                >
                  {stringNum}
                </AppText>
              </View>
            );
          })}
        </View>
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 24,
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
  modeToggle: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
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
});
