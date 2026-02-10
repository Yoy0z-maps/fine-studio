import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/contexts/ThemeContext";
import { useDeviceScale } from "@/hooks/useDeviceScale";

interface MetronomePendulumProps {
  tempo: number;
  isPlaying: boolean;
  currentBeat: number;
}

const BASE_PENDULUM_HEIGHT = 160;
const BASE_PENDULUM_WIDTH = 4;
const BASE_BOB_SIZE = 24;
const BASE_GLOW_SIZE = 32;
const MAX_ANGLE = 25;

export default function MetronomePendulum({
  tempo,
  isPlaying,
  currentBeat,
}: MetronomePendulumProps) {
  const colors = useColors();
  const { scale } = useDeviceScale();
  const rotation = useSharedValue(0);
  const direction = useSharedValue(1); // 1 = right, -1 = left
  const leftGlow = useSharedValue(0);
  const rightGlow = useSharedValue(0);

  const PENDULUM_HEIGHT = BASE_PENDULUM_HEIGHT * scale;
  const PENDULUM_WIDTH = BASE_PENDULUM_WIDTH * scale;
  const BOB_SIZE = BASE_BOB_SIZE * scale;
  const GLOW_SIZE = BASE_GLOW_SIZE * scale;
  const PIVOT_SIZE = 12 * scale;

  // Beat이 변경될 때마다 pendulum 스윙
  useEffect(() => {
    if (!isPlaying) {
      rotation.value = withTiming(0, { duration: 300 });
      return;
    }

    const beatDuration = 60000 / tempo;
    const targetAngle = direction.value * MAX_ANGLE;

    rotation.value = withTiming(targetAngle, {
      duration: beatDuration,
      easing: Easing.inOut(Easing.sin),
    });

    // 방향 전환
    direction.value *= -1;

    // Glow effect
    if (currentBeat % 2 === 0) {
      rightGlow.value = withTiming(1, { duration: 50 }, () => {
        rightGlow.value = withTiming(0, { duration: 150 });
      });
    } else {
      leftGlow.value = withTiming(1, { duration: 50 }, () => {
        leftGlow.value = withTiming(0, { duration: 150 });
      });
    }
  }, [currentBeat, isPlaying]);

  // isPlaying이 false가 되면 중앙으로 복귀
  useEffect(() => {
    if (!isPlaying) {
      rotation.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
      leftGlow.value = 0;
      rightGlow.value = 0;
      direction.value = 1;
    }
  }, [isPlaying]);

  const pendulumStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const leftGlowStyle = useAnimatedStyle(() => ({
    opacity: leftGlow.value,
    transform: [{ scale: 1 + leftGlow.value * 0.2 }],
  }));

  const rightGlowStyle = useAnimatedStyle(() => ({
    opacity: rightGlow.value,
    transform: [{ scale: 1 + rightGlow.value * 0.2 }],
  }));

  return (
    <View style={[styles.container, { height: PENDULUM_HEIGHT + 60 }]}>
      {/* Left glow indicator */}
      <Animated.View
        style={[
          styles.glowIndicator,
          styles.leftGlow,
          {
            width: GLOW_SIZE,
            height: GLOW_SIZE,
            borderRadius: GLOW_SIZE / 2,
            backgroundColor: colors.primary,
          },
          leftGlowStyle,
        ]}
      />

      {/* Pendulum */}
      <View style={styles.pendulumWrapper}>
        <View
          style={[
            styles.pivot,
            { width: PIVOT_SIZE, height: PIVOT_SIZE, borderRadius: PIVOT_SIZE / 2 },
          ]}
        />
        <Animated.View style={[styles.pendulumContainer, pendulumStyle]}>
          <View
            style={[
              styles.pendulumArm,
              {
                width: PENDULUM_WIDTH,
                height: PENDULUM_HEIGHT,
                borderRadius: PENDULUM_WIDTH / 2,
              },
            ]}
          />
          <View
            style={[
              styles.pendulumBob,
              {
                width: BOB_SIZE,
                height: BOB_SIZE,
                borderRadius: BOB_SIZE / 2,
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
              },
            ]}
          />
        </Animated.View>
      </View>

      {/* Right glow indicator */}
      <Animated.View
        style={[
          styles.glowIndicator,
          styles.rightGlow,
          {
            width: GLOW_SIZE,
            height: GLOW_SIZE,
            borderRadius: GLOW_SIZE / 2,
            backgroundColor: colors.primary,
          },
          rightGlowStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 10,
  },
  pendulumWrapper: {
    alignItems: "center",
    flex: 1,
  },
  pivot: {
    backgroundColor: "#555",
    zIndex: 10,
  },
  pendulumContainer: {
    alignItems: "center",
    marginTop: -6,
    transformOrigin: "top center",
  },
  pendulumArm: {
    backgroundColor: "#555",
  },
  pendulumBob: {
    marginTop: -4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  glowIndicator: {
    position: "absolute",
    bottom: 10,
  },
  leftGlow: {
    left: 40,
  },
  rightGlow: {
    right: 40,
  },
});
