import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import { useColors } from "@/contexts/ThemeContext";
import { RawChordPosition, FINGER_COLORS } from "@/types/chord";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PADDING_LEFT = 24; // 뮤트 X, 오픈 O 표시 공간
const PADDING_RIGHT = 16;
const FRETBOARD_WIDTH = SCREEN_WIDTH - 80;
const SVG_WIDTH = FRETBOARD_WIDTH + PADDING_LEFT + PADDING_RIGHT;
const MIN_FRET_COUNT = 5;
const STRING_COUNT = 6;
const STRING_SPACING = 32;
const FRET_NUMBER_HEIGHT = 24;
const PADDING_TOP = FRET_NUMBER_HEIGHT;
const PADDING_BOTTOM = 16;
const FRETBOARD_CONTENT_HEIGHT = STRING_SPACING * (STRING_COUNT - 1) + 16;
const SVG_HEIGHT = PADDING_TOP + FRETBOARD_CONTENT_HEIGHT + PADDING_BOTTOM;

interface GuitarFretboardProps {
  position: RawChordPosition;
}

// frets 문자를 숫자로 변환 (x = -1, 0-9 = 0-9, a-z = 10+)
function parseFret(char: string): number {
  if (char === "x") return -1;
  const code = char.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48; // 0-9
  if (code >= 97 && code <= 122) return code - 97 + 10; // a-z = 10-35
  return -1;
}

export default function GuitarFretboard({ position }: GuitarFretboardProps) {
  const colors = useColors();

  const frets = position.frets.split("").map(parseFret);
  const fingers = position.fingers.split("").map((c) => parseInt(c, 10));

  // 표시할 프렛 범위 계산 - 5프렛보다 넓게 벌어진 보이싱(예: 하이 포지션 바레
  // 코드)도 모든 음이 창 안에 들어오도록 필요하면 창을 넓힌다. 고정폭이면
  // 5프렛을 넘는 음의 손가락 마커가 화면 밖으로 밀려 사라진다.
  const playedFrets = frets.filter((f) => f > 0);
  const minFret = playedFrets.length > 0 ? Math.min(...playedFrets) : 1;
  const maxFret = playedFrets.length > 0 ? Math.max(...playedFrets) : MIN_FRET_COUNT;

  const baseFret = minFret > 4 ? minFret : 1;
  const fretCount = Math.max(MIN_FRET_COUNT, maxFret - baseFret + 1);
  const fretWidth = FRETBOARD_WIDTH / fretCount;

  // 바레 코드 정보 파싱
  const barreFretsSet = new Set(
    position.barres?.split(",").map((b) => parseInt(b, 10)) || []
  );

  // 지판 시작 Y 좌표
  const fretboardY = PADDING_TOP + 8;

  return (
    <View style={styles.container}>
      <Svg width={SVG_WIDTH} height={SVG_HEIGHT}>
        {/* 프렛 번호 (지판 위) */}
        {Array.from({ length: fretCount }).map((_, i) => {
          const fretNum = baseFret + i;
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
          const isNut = i === 0 && baseFret === 1;
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
        {[3, 5, 7, 9, 12].map((fretNum) => {
          if (fretNum < baseFret || fretNum >= baseFret + fretCount) return null;
          const fretPos = fretNum - baseFret + 1;
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
              r={6}
              fill="#5D4037"
              opacity={0.5}
            />
          );
        })}

        {/* 뮤트/오픈 표시 - stringIndex 0=6번줄(아래), 5=1번줄(위) */}
        {frets.map((fret, stringIndex) => {
          // stringIndex 0 = 6번줄 = 화면 아래 (i=5)
          // stringIndex 5 = 1번줄 = 화면 위 (i=0)
          const screenIndex = STRING_COUNT - 1 - stringIndex;
          const y = fretboardY + 8 + screenIndex * STRING_SPACING;

          if (fret === -1) {
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

        {/* 손가락 위치 - stringIndex 0=6번줄(아래), 5=1번줄(위) */}
        {frets.map((fret, stringIndex) => {
          if (fret <= 0) return null;

          const displayFret = fret - baseFret + 1;
          if (displayFret < 1 || displayFret > fretCount) return null;

          const fingerNum = fingers[stringIndex] || 0;
          const screenIndex = STRING_COUNT - 1 - stringIndex;
          const x = PADDING_LEFT + (displayFret - 0.5) * fretWidth;
          const y = fretboardY + 8 + screenIndex * STRING_SPACING;

          return (
            <React.Fragment key={`finger-${stringIndex}`}>
              <Circle
                cx={x}
                cy={y}
                r={12}
                fill={fingerNum > 0 ? FINGER_COLORS[fingerNum] : colors.primary}
                stroke="#fff"
                strokeWidth={2}
              />
              {fingerNum > 0 && (
                <SvgText
                  x={x}
                  y={y + 4}
                  fill="#fff"
                  fontSize={12}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {fingerNum}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}

        {/* 바레 코드 */}
        {Array.from(barreFretsSet).map((barreFret) => {
          const displayFret = barreFret - baseFret + 1;
          if (displayFret < 1 || displayFret > fretCount) return null;

          const barreStrings = frets
            .map((f, idx) => (f === barreFret ? idx : -1))
            .filter((idx) => idx >= 0);
          if (barreStrings.length < 2) return null;

          const firstString = Math.min(...barreStrings);
          const lastString = Math.max(...barreStrings);

          const x = PADDING_LEFT + (displayFret - 0.5) * fretWidth;
          const topScreenIndex = STRING_COUNT - 1 - lastString;
          const bottomScreenIndex = STRING_COUNT - 1 - firstString;
          const topY = fretboardY + 8 + topScreenIndex * STRING_SPACING;
          const bottomY = fretboardY + 8 + bottomScreenIndex * STRING_SPACING;

          return (
            <Rect
              key={`barre-${barreFret}`}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 16,
  },
});
