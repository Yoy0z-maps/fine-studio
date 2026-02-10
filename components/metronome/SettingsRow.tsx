import { StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import { DisplayMode } from "@/utils/metronome/types";
import { useColors } from "@/contexts/ThemeContext";

interface DisplayRowProps {
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
}

interface SettingsRowProps {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  accentFirstBeat: boolean;
  onSoundEnabledChange: (enabled: boolean) => void;
  onHapticEnabledChange: (enabled: boolean) => void;
  onAccentFirstBeatChange: (enabled: boolean) => void;
}

// Display 모드만 표시하는 상단 컴포넌트
export function DisplayRow({ displayMode, onDisplayModeChange }: DisplayRowProps) {
  const { t } = useTranslation("common");
  const colors = useColors();

  return (
    <View style={styles.displayContainer}>
      <AppText style={styles.displayLabel}>{t("metronome.display")}</AppText>
      <View style={styles.displayToggle}>
        <TouchableOpacity
          style={[
            styles.toggleOption,
            displayMode === "circle" && { backgroundColor: colors.primary },
          ]}
          onPress={() => onDisplayModeChange("circle")}
        >
          <AppText
            style={[
              styles.toggleText,
              displayMode === "circle" && styles.toggleTextActive,
            ]}
          >
            {t("metronome.circle")}
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleOption,
            displayMode === "pendulum" && { backgroundColor: colors.primary },
          ]}
          onPress={() => onDisplayModeChange("pendulum")}
        >
          <AppText
            style={[
              styles.toggleText,
              displayMode === "pendulum" && styles.toggleTextActive,
            ]}
          >
            {t("metronome.pendulum")}
          </AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Sound, Haptic, Accent 설정 (재생 버튼 아래용)
export default function SettingsRow({
  soundEnabled,
  hapticEnabled,
  accentFirstBeat,
  onSoundEnabledChange,
  onHapticEnabledChange,
  onAccentFirstBeatChange,
}: SettingsRowProps) {
  const { t } = useTranslation("common");
  const colors = useColors();
  const trackColorOn = `${colors.primary}66`;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.setting}>
          <AppText style={styles.label}>{t("metronome.sound")}</AppText>
          <Switch
            value={soundEnabled}
            onValueChange={onSoundEnabledChange}
            trackColor={{ false: "#333", true: trackColorOn }}
            thumbColor={soundEnabled ? colors.primary : "#666"}
          />
        </View>

        <View style={styles.setting}>
          <AppText style={styles.label}>{t("metronome.haptic")}</AppText>
          <Switch
            value={hapticEnabled}
            onValueChange={onHapticEnabledChange}
            trackColor={{ false: "#333", true: trackColorOn }}
            thumbColor={hapticEnabled ? colors.primary : "#666"}
          />
        </View>

        <View style={styles.setting}>
          <AppText style={styles.label}>{t("metronome.accent")}</AppText>
          <Switch
            value={accentFirstBeat}
            onValueChange={onAccentFirstBeatChange}
            trackColor={{ false: "#333", true: trackColorOn }}
            thumbColor={accentFirstBeat ? colors.primary : "#666"}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  setting: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: "#888",
  },
  displayContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  displayLabel: {
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },
  displayToggle: {
    flexDirection: "row",
    backgroundColor: "#222",
    borderRadius: 8,
    overflow: "hidden",
  },
  toggleOption: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  toggleText: {
    fontSize: 14,
    color: "#888",
  },
  toggleTextActive: {
    color: "#fff",
  },
});
