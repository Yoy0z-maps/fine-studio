import { StyleSheet, TouchableOpacity, View } from "react-native";
import Svg, { Line, Circle, Text as SvgText, G } from "react-native-svg";
import AppText from "@/components/AppText";
import { Subdivision, SUBDIVISIONS } from "@/utils/metronome/types";
import { useColors } from "@/contexts/ThemeContext";

interface SubdivisionPickerProps {
  selected: Subdivision;
  onSelect: (sub: Subdivision) => void;
}

// 음표 아이콘 컴포넌트
function NoteIcon({ type, color, size = 24 }: { type: Subdivision; color: string; size?: number }) {
  const noteHead = (x: number, y: number) => (
    <Circle cx={x} cy={y} rx={4} ry={3} fill={color} />
  );

  const stem = (x: number, y1: number, y2: number) => (
    <Line x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth={1.5} />
  );

  const flag = (x: number, y: number, count: number) => {
    const flags = [];
    for (let i = 0; i < count; i++) {
      flags.push(
        <Line
          key={i}
          x1={x}
          y1={y + i * 4}
          x2={x + 5}
          y2={y + 3 + i * 4}
          stroke={color}
          strokeWidth={1.5}
        />
      );
    }
    return flags;
  };

  const beam = (x1: number, x2: number, y: number, count: number) => {
    const beams = [];
    for (let i = 0; i < count; i++) {
      beams.push(
        <Line
          key={i}
          x1={x1}
          y1={y + i * 3}
          x2={x2}
          y2={y + i * 3}
          stroke={color}
          strokeWidth={2}
        />
      );
    }
    return beams;
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {type === "quarter" && (
        <G>
          {/* 4분음표 */}
          <Circle cx={8} cy={18} rx={4} ry={3} fill={color} />
          <Line x1={12} y1={18} x2={12} y2={4} stroke={color} strokeWidth={1.5} />
        </G>
      )}
      {type === "eighth" && (
        <G>
          {/* 8분음표 2개 연결 */}
          <Circle cx={5} cy={18} rx={3} ry={2.5} fill={color} />
          <Circle cx={17} cy={18} rx={3} ry={2.5} fill={color} />
          <Line x1={8} y1={18} x2={8} y2={6} stroke={color} strokeWidth={1.5} />
          <Line x1={20} y1={18} x2={20} y2={6} stroke={color} strokeWidth={1.5} />
          <Line x1={8} y1={6} x2={20} y2={6} stroke={color} strokeWidth={2} />
        </G>
      )}
      {type === "triplet" && (
        <G>
          {/* 3연음 */}
          <Circle cx={3} cy={18} rx={2.5} ry={2} fill={color} />
          <Circle cx={11} cy={18} rx={2.5} ry={2} fill={color} />
          <Circle cx={19} cy={18} rx={2.5} ry={2} fill={color} />
          <Line x1={5.5} y1={18} x2={5.5} y2={7} stroke={color} strokeWidth={1.2} />
          <Line x1={13.5} y1={18} x2={13.5} y2={7} stroke={color} strokeWidth={1.2} />
          <Line x1={21.5} y1={18} x2={21.5} y2={7} stroke={color} strokeWidth={1.2} />
          <Line x1={5.5} y1={7} x2={21.5} y2={7} stroke={color} strokeWidth={1.5} />
          <SvgText x={12} y={5} fill={color} fontSize={6} fontWeight="bold" textAnchor="middle">3</SvgText>
        </G>
      )}
      {type === "sixteenth" && (
        <G>
          {/* 16분음표 2개 연결 */}
          <Circle cx={5} cy={18} rx={3} ry={2.5} fill={color} />
          <Circle cx={17} cy={18} rx={3} ry={2.5} fill={color} />
          <Line x1={8} y1={18} x2={8} y2={5} stroke={color} strokeWidth={1.5} />
          <Line x1={20} y1={18} x2={20} y2={5} stroke={color} strokeWidth={1.5} />
          <Line x1={8} y1={5} x2={20} y2={5} stroke={color} strokeWidth={2} />
          <Line x1={8} y1={8} x2={20} y2={8} stroke={color} strokeWidth={2} />
        </G>
      )}
    </Svg>
  );
}

export default function SubdivisionPicker({
  selected,
  onSelect,
}: SubdivisionPickerProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <AppText style={[styles.label, { color: colors.textSecondary }]}>Beat</AppText>
      <View style={styles.options}>
        {SUBDIVISIONS.map((sub) => {
          const isSelected = selected === sub.value;
          return (
            <TouchableOpacity
              key={sub.value}
              style={[
                styles.option,
                { backgroundColor: colors.surface },
                isSelected && { backgroundColor: colors.primary },
              ]}
              onPress={() => onSelect(sub.value)}
            >
              <NoteIcon
                type={sub.value}
                color={isSelected ? "#fff" : colors.textSecondary}
                size={28}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 14,
    width: 50,
  },
  options: {
    flexDirection: "row",
    flex: 1,
    gap: 8,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
