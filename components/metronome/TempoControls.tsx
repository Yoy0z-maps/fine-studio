import { StyleSheet, TouchableOpacity, View } from "react-native";
import Slider from "@react-native-community/slider";
import AppText from "@/components/AppText";
import { MIN_TEMPO, MAX_TEMPO } from "@/utils/metronome/types";
import { useColors } from "@/contexts/ThemeContext";

interface TempoControlsProps {
  tempo: number;
  onTempoChange: (tempo: number) => void;
  onTap: () => void;
  tapCount?: number;
}

export default function TempoControls({
  tempo,
  onTempoChange,
  onTap,
  tapCount = 0,
}: TempoControlsProps) {
  const colors = useColors();

  const handleDecrease = () => {
    onTempoChange(Math.max(MIN_TEMPO, tempo - 1));
  };

  const handleIncrease = () => {
    onTempoChange(Math.min(MAX_TEMPO, tempo + 1));
  };

  const handleBigDecrease = () => {
    onTempoChange(Math.max(MIN_TEMPO, tempo - 10));
  };

  const handleBigIncrease = () => {
    onTempoChange(Math.min(MAX_TEMPO, tempo + 10));
  };

  return (
    <View style={styles.container}>
      {/* BPM Display (정중앙) + TAP Button (오른쪽) */}
      <View style={styles.bpmRow}>
        {/* 왼쪽 빈 공간 (TAP 버튼과 균형) */}
        <View style={styles.spacer} />

        {/* BPM 중앙 */}
        <View style={styles.bpmDisplay}>
          <AppText style={styles.bpmValue}>{tempo}</AppText>
          <AppText style={styles.bpmLabel}>BPM</AppText>
        </View>

        {/* TAP 버튼 오른쪽 */}
        <View style={styles.tapContainer}>
          <TouchableOpacity
            style={[styles.tapButton, { backgroundColor: colors.surface }]}
            onPress={onTap}
          >
            <AppText style={[styles.tapButtonText, { color: colors.primary }]}>TAP</AppText>
            {tapCount > 0 && (
              <AppText style={styles.tapCount}>{tapCount}</AppText>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Slider with +/- buttons */}
      <View style={styles.sliderRow}>
        <TouchableOpacity
          style={styles.smallButton}
          onPress={handleBigDecrease}
          onLongPress={handleBigDecrease}
        >
          <AppText style={styles.buttonText}>−10</AppText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleDecrease}>
          <AppText style={styles.buttonText}>−</AppText>
        </TouchableOpacity>

        <Slider
          style={styles.slider}
          minimumValue={MIN_TEMPO}
          maximumValue={MAX_TEMPO}
          step={1}
          value={tempo}
          onValueChange={onTempoChange}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor="#444"
          thumbTintColor={colors.primary}
        />

        <TouchableOpacity style={styles.button} onPress={handleIncrease}>
          <AppText style={styles.buttonText}>+</AppText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.smallButton}
          onPress={handleBigIncrease}
          onLongPress={handleBigIncrease}
        >
          <AppText style={styles.buttonText}>+10</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 16,
  },
  bpmRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  spacer: {
    width: 72, // TAP 버튼과 동일한 너비
  },
  bpmDisplay: {
    flex: 1,
    alignItems: "center",
  },
  bpmValue: {
    fontSize: 72,
    fontWeight: "700",
    color: "#fff",
  },
  bpmLabel: {
    fontSize: 16,
    color: "#888",
    marginTop: -8,
  },
  tapContainer: {
    width: 72,
    alignItems: "center",
  },
  tapButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  tapButtonText: {
    fontSize: 18,
    fontWeight: "700",
  },
  tapCount: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 8,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  smallButton: {
    width: 44,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
});
