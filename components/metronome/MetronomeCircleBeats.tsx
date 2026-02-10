import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/contexts/ThemeContext";
import { useDeviceScale } from "@/hooks/useDeviceScale";

interface MetronomeCircleBeatsProps {
  beats: number;
  currentBeat: number;
  isPlaying: boolean;
  accentFirstBeat?: boolean;
}

const BASE_CIRCLE_SIZE = 200;
const BASE_DOT_SIZE = 24;

export default function MetronomeCircleBeats({
  beats,
  currentBeat,
  isPlaying,
  accentFirstBeat = true,
}: MetronomeCircleBeatsProps) {
  const colors = useColors();
  const { scale } = useDeviceScale();

  const CIRCLE_SIZE = BASE_CIRCLE_SIZE * scale;
  const DOT_SIZE = BASE_DOT_SIZE * scale;

  return (
    <View style={styles.container}>
      <View style={[styles.circle, { width: CIRCLE_SIZE, height: CIRCLE_SIZE }]}>
        {Array.from({ length: beats }).map((_, index) => (
          <BeatDot
            key={index}
            index={index}
            totalBeats={beats}
            isActive={isPlaying && currentBeat === index}
            isAccent={accentFirstBeat && index === 0}
            accentColor={colors.primary}
            circleSize={CIRCLE_SIZE}
            dotSize={DOT_SIZE}
          />
        ))}
      </View>
    </View>
  );
}

interface BeatDotProps {
  index: number;
  totalBeats: number;
  isActive: boolean;
  isAccent: boolean;
  accentColor: string;
  circleSize: number;
  dotSize: number;
}

function BeatDot({
  index,
  totalBeats,
  isActive,
  isAccent,
  accentColor,
  circleSize,
  dotSize,
}: BeatDotProps) {
  const scaleAnim = useSharedValue(1);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    if (isActive) {
      scaleAnim.value = withSpring(1.5, {
        damping: 8,
        stiffness: 400,
        mass: 0.5,
      });
      opacity.value = withTiming(1, { duration: 30 });
    } else {
      scaleAnim.value = withSpring(1, {
        damping: 12,
        stiffness: 300,
      });
      opacity.value = withTiming(0.3, { duration: 100 });
    }
  }, [isActive, scaleAnim, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
    opacity: opacity.value,
  }));

  // Calculate position on circle
  const angle = (index / totalBeats) * 2 * Math.PI - Math.PI / 2;
  const radius = circleSize / 2 - dotSize;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
        },
        isAccent && { backgroundColor: accentColor },
        {
          left: circleSize / 2 + x - dotSize / 2,
          top: circleSize / 2 + y - dotSize / 2,
        },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  circle: {
    position: "relative",
  },
  dot: {
    position: "absolute",
    backgroundColor: "#666",
  },
});
