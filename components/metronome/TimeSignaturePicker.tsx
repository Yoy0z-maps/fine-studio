import { StyleSheet, TouchableOpacity, View, ScrollView } from "react-native";
import AppText from "@/components/AppText";
import { TimeSignature, DEFAULT_TIME_SIGNATURES } from "@/utils/metronome/types";
import { useColors } from "@/contexts/ThemeContext";

interface TimeSignaturePickerProps {
  selected: TimeSignature;
  onSelect: (ts: TimeSignature) => void;
}

export default function TimeSignaturePicker({
  selected,
  onSelect,
}: TimeSignaturePickerProps) {
  const colors = useColors();
  const isSelected = (ts: TimeSignature) =>
    ts.beats === selected.beats && ts.noteValue === selected.noteValue;

  return (
    <View style={styles.container}>
      <AppText style={styles.label}>Time</AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {DEFAULT_TIME_SIGNATURES.map((ts) => (
          <TouchableOpacity
            key={`${ts.beats}/${ts.noteValue}`}
            style={[
              styles.option,
              isSelected(ts) && { backgroundColor: colors.primary },
            ]}
            onPress={() => onSelect(ts)}
          >
            <AppText
              style={[
                styles.optionText,
                isSelected(ts) && styles.optionTextSelected,
              ]}
            >
              {ts.beats}/{ts.noteValue}
            </AppText>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingLeft: 16,
  },
  label: {
    fontSize: 14,
    color: "#888",
    width: 45,
  },
  scrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  option: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#222",
  },
  optionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#888",
  },
  optionTextSelected: {
    color: "#fff",
  },
});
