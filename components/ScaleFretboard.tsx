import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import AppText from "@/components/AppText";
import { useColors } from "@/contexts/ThemeContext";
import { ScalePattern, ROOT_COLOR, NOTE_COLOR } from "@/types/scale";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PADDING_LEFT = 16; // 왼쪽 여백 (노트 원이 잘리지 않도록)
const PADDING_RIGHT = 16; // 오른쪽 여백
const FRETBOARD_WIDTH = SCREEN_WIDTH - 64; // 실제 지판 너비
const SVG_WIDTH = FRETBOARD_WIDTH + PADDING_LEFT + PADDING_RIGHT;
const STRING_COUNT = 6;
const STRING_SPACING = 32;
const FRET_NUMBER_HEIGHT = 24;
const PADDING_TOP = FRET_NUMBER_HEIGHT;
const PADDING_BOTTOM = 16;
const FRETBOARD_CONTENT_HEIGHT = STRING_SPACING * (STRING_COUNT - 1) + 16;
const SVG_HEIGHT = PADDING_TOP + FRETBOARD_CONTENT_HEIGHT + PADDING_BOTTOM;

// 블루 노트 색상
const BLUE_NOTE_COLOR = "#9C27B0"; // 보라색

interface ScaleFretboardProps {
  pattern: ScalePattern;
}

export default function ScaleFretboard({ pattern }: ScaleFretboardProps) {
  const colors = useColors();

  // 프렛 범위 계산
  const allFrets: number[] = [];
  pattern.positions.forEach((pos) => {
    allFrets.push(...pos.frets);
  });
  const minFret = Math.min(...allFrets);
  const maxFret = Math.max(...allFrets);

  // 표시할 프렛 수 계산
  const fretSpan = maxFret - minFret;
  const fretCount = Math.max(5, fretSpan + 2);
  const fretWidth = FRETBOARD_WIDTH / fretCount;

  // 시작 프렛 결정
  const baseFret = minFret === 0 ? 0 : Math.max(0, minFret - 1);

  // 지판 시작 Y 좌표
  const fretboardY = PADDING_TOP + 8;

  return (
    <View style={styles.container}>
      <Svg width={SVG_WIDTH} height={SVG_HEIGHT}>
        {/* 프렛 번호 (지판 위) */}
        {Array.from({ length: fretCount }).map((_, i) => {
          const fretNum = baseFret + i + (baseFret === 0 ? 1 : 0);
          const x = PADDING_LEFT + (i + 0.5) * fretWidth;
          return (
            <SvgText
              key={`fret-num-${i}`}
              x={x}
              y={16}
              fontSize={12}
              fontWeight="600"
              fill={colors.textSecondary}
              textAnchor="middle"
            >
              {fretNum}
            </SvgText>
          );
        })}

        {/* 배경 */}
        <Rect
          x={PADDING_LEFT}
          y={fretboardY}
          width={FRETBOARD_WIDTH}
          height={FRETBOARD_CONTENT_HEIGHT}
          fill="#8B5A2B"
          rx={4}
        />

        {/* 프렛 라인 (세로) */}
        {Array.from({ length: fretCount + 1 }).map((_, i) => {
          const isNut = i === 0 && baseFret === 0;
          return (
            <Line
              key={`fret-${i}`}
              x1={PADDING_LEFT + i * fretWidth}
              y1={fretboardY}
              x2={PADDING_LEFT + i * fretWidth}
              y2={fretboardY + FRETBOARD_CONTENT_HEIGHT}
              stroke={isNut ? "#D4A574" : "#A0A0A0"}
              strokeWidth={isNut ? 8 : 3}
            />
          );
        })}

        {/* 줄 라인 (가로) - 위(i=0)=1번줄(얇음), 아래(i=5)=6번줄(두꺼움) */}
        {Array.from({ length: STRING_COUNT }).map((_, i) => {
          // i=0 → 1번줄 (high E, 가장 얇음)
          // i=5 → 6번줄 (low E, 가장 두꺼움)
          return (
            <Line
              key={`string-${i}`}
              x1={PADDING_LEFT}
              y1={fretboardY + 8 + i * STRING_SPACING}
              x2={PADDING_LEFT + FRETBOARD_WIDTH}
              y2={fretboardY + 8 + i * STRING_SPACING}
              stroke="#C0C0C0"
              strokeWidth={1 + i * 0.4}
            />
          );
        })}

        {/* 프렛 마커 */}
        {[3, 5, 7, 9, 12, 15, 17].map((fretNum) => {
          if (fretNum < baseFret || fretNum >= baseFret + fretCount) return null;
          const fretPos = fretNum - baseFret + (baseFret === 0 ? 0 : 1);
          const x = PADDING_LEFT + (fretPos - 0.5) * fretWidth;
          const y = fretboardY + 8 + (STRING_SPACING * (STRING_COUNT - 1)) / 2;

          if (fretNum === 12) {
            return (
              <React.Fragment key={`marker-${fretNum}`}>
                <Circle cx={x} cy={y - 20} r={5} fill="#5D4037" opacity={0.5} />
                <Circle cx={x} cy={y + 20} r={5} fill="#5D4037" opacity={0.5} />
              </React.Fragment>
            );
          }

          return (
            <Circle
              key={`marker-${fretNum}`}
              cx={x}
              cy={y}
              r={5}
              fill="#5D4037"
              opacity={0.5}
            />
          );
        })}

        {/* 스케일 노트 */}
        {pattern.positions.map((stringPos) => {
          // string: 1=high E(위), 6=low E(아래)
          // SVG에서 위가 0이므로 변환: 1번줄 -> index 0, 6번줄 -> index 5
          const stringIndex = stringPos.string - 1;
          const y = fretboardY + 8 + stringIndex * STRING_SPACING;

          return stringPos.frets.map((fret, fretIdx) => {
            const displayFret = fret - baseFret + (baseFret === 0 ? 0 : 1);
            if (displayFret < 0 || displayFret > fretCount) return null;

            const isRoot = stringPos.root_frets?.includes(fret);
            const isBlueNote = stringPos.blue_notes?.includes(fret);

            let noteColor = NOTE_COLOR;
            if (isRoot) noteColor = ROOT_COLOR;
            else if (isBlueNote) noteColor = BLUE_NOTE_COLOR;

            // 오픈 스트링인 경우 (프렛 0은 지판 왼쪽에 표시)
            if (fret === 0) {
              return (
                <Circle
                  key={`note-${stringPos.string}-${fret}-${fretIdx}`}
                  cx={PADDING_LEFT - 14}
                  cy={y}
                  r={10}
                  fill={isRoot ? noteColor : "none"}
                  stroke={noteColor}
                  strokeWidth={2}
                />
              );
            }

            const x = PADDING_LEFT + (displayFret - 0.5) * fretWidth;

            return (
              <Circle
                key={`note-${stringPos.string}-${fret}-${fretIdx}`}
                cx={x}
                cy={y}
                r={12}
                fill={noteColor}
                stroke="#fff"
                strokeWidth={isRoot ? 3 : 1}
              />
            );
          });
        })}
      </Svg>

      {/* 범례 */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ROOT_COLOR }]} />
          <AppText style={[styles.legendText, { color: colors.textSecondary }]}>
            Root
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: NOTE_COLOR }]} />
          <AppText style={[styles.legendText, { color: colors.textSecondary }]}>
            Note
          </AppText>
        </View>
        {pattern.positions.some((p) => p.blue_notes?.length) && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: BLUE_NOTE_COLOR }]} />
            <AppText style={[styles.legendText, { color: colors.textSecondary }]}>
              Blue Note
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 16,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
  },
});
