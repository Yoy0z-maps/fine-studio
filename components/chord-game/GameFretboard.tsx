import React from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import AppText from "@/components/AppText";
import { useColors } from "@/contexts/ThemeContext";
import { ChordPosition, FINGER_COLORS } from "@/types/chord";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PADDING_LEFT = 24;
const PADDING_RIGHT = 16;
const FRETBOARD_WIDTH = SCREEN_WIDTH - 80;
const SVG_WIDTH = FRETBOARD_WIDTH + PADDING_LEFT + PADDING_RIGHT;
const FRET_COUNT = 5;
const STRING_COUNT = 6;
const FRET_WIDTH = FRETBOARD_WIDTH / FRET_COUNT;
const STRING_SPACING = 32;
const FRET_NUMBER_HEIGHT = 24;
const PADDING_TOP = FRET_NUMBER_HEIGHT;
const PADDING_BOTTOM = 16;
const FRETBOARD_CONTENT_HEIGHT = STRING_SPACING * (STRING_COUNT - 1) + 16;
const SVG_HEIGHT = PADDING_TOP + FRETBOARD_CONTENT_HEIGHT + PADDING_BOTTOM;

interface GameFretboardProps {
  position: ChordPosition | null;
  userFrets?: number[];
  interactive?: boolean;
  showAnswer?: boolean;
  answerPosition?: ChordPosition;
  onFretTouch?: (stringIndex: number, fret: number) => void;
}

export default function GameFretboard({
  position,
  userFrets = [-1, -1, -1, -1, -1, -1],
  interactive = false,
  showAnswer = false,
  answerPosition,
  onFretTouch,
}: GameFretboardProps) {
  const colors = useColors();

  const displayPosition = showAnswer && answerPosition ? answerPosition : position;
  const baseFret = displayPosition?.baseFret || 1;
  const displayFrets = interactive ? userFrets : displayPosition?.frets || [];

  // 지판 시작 Y 좌표
  const fretboardY = PADDING_TOP + 8;

  return (
    <View style={styles.container}>
      <Svg width={SVG_WIDTH} height={SVG_HEIGHT}>
        {/* 프렛 번호 (지판 위) */}
        {Array.from({ length: FRET_COUNT }).map((_, i) => {
          const fretNum = baseFret + i;
          const x = PADDING_LEFT + (i + 0.5) * FRET_WIDTH;
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
        {Array.from({ length: FRET_COUNT + 1 }).map((_, i) => {
          const isNut = i === 0 && baseFret === 1;
          return (
            <Line
              key={`fret-${i}`}
              x1={PADDING_LEFT + i * FRET_WIDTH}
              y1={fretboardY}
              x2={PADDING_LEFT + i * FRET_WIDTH}
              y2={fretboardY + FRETBOARD_CONTENT_HEIGHT}
              stroke={isNut ? "#D4A574" : "#A0A0A0"}
              strokeWidth={isNut ? 8 : 3}
            />
          );
        })}

        {/* 줄 라인 - 위(i=0)=1번줄(얇음), 아래(i=5)=6번줄(두꺼움) */}
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
        {[3, 5, 7, 9, 12].map((fretNum) => {
          if (fretNum < baseFret || fretNum >= baseFret + FRET_COUNT) return null;
          const fretPos = fretNum - baseFret + 1;
          const x = PADDING_LEFT + (fretPos - 0.5) * FRET_WIDTH;
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
              r={6}
              fill="#5D4037"
              opacity={0.5}
            />
          );
        })}

        {/* 뮤트/오픈 표시 - stringIndex 0=6번줄(아래), 5=1번줄(위) */}
        {displayFrets.map((fret, stringIndex) => {
          const screenIndex = STRING_COUNT - 1 - stringIndex;
          const y = fretboardY + 8 + screenIndex * STRING_SPACING;

          if (fret === -1 && !interactive) {
            return (
              <SvgText
                key={`mute-${stringIndex}`}
                x={PADDING_LEFT - 14}
                y={y + 5}
                fill={colors.red || "#FF5252"}
                fontSize={14}
                fontWeight="bold"
                textAnchor="middle"
              >
                X
              </SvgText>
            );
          } else if (fret === 0) {
            return (
              <Circle
                key={`open-${stringIndex}`}
                cx={PADDING_LEFT - 14}
                cy={y}
                r={8}
                fill="none"
                stroke={colors.primary}
                strokeWidth={2}
              />
            );
          }
          return null;
        })}

        {/* 손가락 위치 (뷰 모드) - stringIndex 0=6번줄(아래), 5=1번줄(위) */}
        {!interactive &&
          displayFrets.map((fret, stringIndex) => {
            if (fret <= 0) return null;
            const fingerNum = displayPosition?.fingers?.[stringIndex] || 0;
            const screenIndex = STRING_COUNT - 1 - stringIndex;
            const x = PADDING_LEFT + (fret - 0.5) * FRET_WIDTH;
            const y = fretboardY + 8 + screenIndex * STRING_SPACING;
            return (
              <Circle
                key={`finger-${stringIndex}`}
                cx={x}
                cy={y}
                r={12}
                fill={fingerNum > 0 ? FINGER_COLORS[fingerNum] : colors.primary}
                stroke="#fff"
                strokeWidth={2}
              />
            );
          })}

        {/* 사용자 입력 (인터랙티브 모드) */}
        {interactive &&
          userFrets.map((fret, stringIndex) => {
            if (fret <= 0) return null;
            const screenIndex = STRING_COUNT - 1 - stringIndex;
            const x = PADDING_LEFT + (fret - 0.5) * FRET_WIDTH;
            const y = fretboardY + 8 + screenIndex * STRING_SPACING;
            return (
              <Circle
                key={`user-${stringIndex}`}
                cx={x}
                cy={y}
                r={12}
                fill={colors.primary}
                stroke="#fff"
                strokeWidth={2}
              />
            );
          })}

        {/* 정답 표시 (오답 시) */}
        {showAnswer &&
          displayPosition?.frets.map((fret, stringIndex) => {
            if (fret <= 0) return null;
            const screenIndex = STRING_COUNT - 1 - stringIndex;
            const x = PADDING_LEFT + (fret - 0.5) * FRET_WIDTH;
            const y = fretboardY + 8 + screenIndex * STRING_SPACING;
            return (
              <Circle
                key={`answer-${stringIndex}`}
                cx={x}
                cy={y}
                r={12}
                fill={colors.primary}
                stroke="#fff"
                strokeWidth={2}
                opacity={0.8}
              />
            );
          })}

        {/* 바레 코드 */}
        {displayPosition?.barres?.map((barreFret, i) => {
          const x = PADDING_LEFT + (barreFret - 0.5) * FRET_WIDTH;
          const barreStrings = displayPosition.frets
            .map((f, idx) => (f === barreFret ? idx : -1))
            .filter((idx) => idx >= 0);
          if (barreStrings.length < 2) return null;

          const firstString = Math.min(...barreStrings);
          const lastString = Math.max(...barreStrings);

          const topScreenIndex = STRING_COUNT - 1 - lastString;
          const bottomScreenIndex = STRING_COUNT - 1 - firstString;
          const topY = fretboardY + 8 + topScreenIndex * STRING_SPACING;
          const bottomY = fretboardY + 8 + bottomScreenIndex * STRING_SPACING;

          return (
            <Rect
              key={`barre-${i}`}
              x={x - 14}
              y={topY - 8}
              width={28}
              height={bottomY - topY + 16}
              rx={8}
              fill={FINGER_COLORS[1]}
              opacity={0.6}
            />
          );
        })}
      </Svg>

      {/* 터치 영역 (인터랙티브 모드) - 위에서부터 1번줄(index 5), 아래가 6번줄(index 0) */}
      {interactive && onFretTouch && (
        <View style={[styles.touchOverlay, { top: fretboardY + 8 - STRING_SPACING / 2 }]}>
          {Array.from({ length: STRING_COUNT }).map((_, rowIndex) => {
            const stringIndex = STRING_COUNT - 1 - rowIndex; // 위에서부터 5, 4, 3, 2, 1, 0
            return (
              <View key={stringIndex} style={styles.touchRow}>
                {/* 오픈 스트링 버튼 */}
                <Pressable
                  style={[
                    styles.touchBtn,
                    styles.touchBtnOpen,
                    userFrets[stringIndex] === 0 && {
                      backgroundColor: colors.primary + "40",
                    },
                  ]}
                  onPress={() => onFretTouch(stringIndex, 0)}
                >
                  <AppText style={[styles.touchBtnText, { color: colors.text }]}>
                    O
                  </AppText>
                </Pressable>
                {/* 각 프렛 버튼 */}
                {Array.from({ length: FRET_COUNT }).map((_, fretIndex) => (
                  <Pressable
                    key={fretIndex}
                    style={[
                      styles.touchBtn,
                      { width: FRET_WIDTH - 4 },
                      userFrets[stringIndex] === fretIndex + 1 && {
                        backgroundColor: colors.primary + "40",
                      },
                    ]}
                    onPress={() => onFretTouch(stringIndex, fretIndex + 1)}
                  />
                ))}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 16,
  },
  touchOverlay: {
    position: "absolute",
    left: PADDING_LEFT,
    right: PADDING_RIGHT,
  },
  touchRow: {
    flexDirection: "row",
    height: STRING_SPACING,
    alignItems: "center",
  },
  touchBtn: {
    height: STRING_SPACING - 4,
    marginHorizontal: 2,
    borderRadius: 4,
  },
  touchBtnOpen: {
    width: 28,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -30,
  },
  touchBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
