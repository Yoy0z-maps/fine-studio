import { InstrumentId } from "@/utils/audio/instruments";
import { memo } from "react";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

// Instrument silhouettes, drawn upright (headstock or scroll at y = 0, centered on x = 0) and
// tilted 45 degrees into a 32x32 box. `hole` parts (sound holes, f-holes, pickups) are painted in
// the background color.
type Shape = { hole?: boolean } & (
  | { type: "rect"; x: number; y: number; width: number; height: number; r?: number }
  | { type: "circle"; cx: number; cy: number; r: number }
  | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { type: "path"; d: string }
);

type Drawing = { length: number; scale: number; shapes: Shape[] };

// Scroll, pegbox, neck and an hourglass body with f-holes and a bridge.
const BOWED_BODY: Shape[] = [
  { type: "circle", cx: 0, cy: 2.5, r: 2.5 },
  { type: "circle", cx: 0.35, cy: 2.35, r: 0.95, hole: true },
  { type: "rect", x: -1.55, y: 4, width: 3.1, height: 5.6, r: 0.6 },
  { type: "rect", x: -3.4, y: 4.85, width: 6.8, height: 1.1, r: 0.55 },
  { type: "rect", x: -3.4, y: 7.25, width: 6.8, height: 1.1, r: 0.55 },
  { type: "rect", x: -1.25, y: 9, width: 2.5, height: 12 },
  { type: "ellipse", cx: 0, cy: 24.3, rx: 6.3, ry: 5.6 },
  { type: "ellipse", cx: 0, cy: 35.9, rx: 7.6, ry: 6.9 },
  { type: "path", d: "M-5.2 26.8 C-3.3 28.3 -3.3 31.4 -5.9 33 L5.9 33 C3.3 31.4 3.3 28.3 5.2 26.8 Z" },
  { type: "rect", x: -3.13, y: 29.1, width: 0.76, height: 5.2, r: 0.38, hole: true },
  { type: "circle", cx: -2.75, cy: 29.1, r: 0.6, hole: true },
  { type: "circle", cx: -2.75, cy: 34.3, r: 0.6, hole: true },
  { type: "rect", x: 2.37, y: 29.1, width: 0.76, height: 5.2, r: 0.38, hole: true },
  { type: "circle", cx: 2.75, cy: 29.1, r: 0.6, hole: true },
  { type: "circle", cx: 2.75, cy: 34.3, r: 0.6, hole: true },
  { type: "rect", x: -1.9, y: 33.3, width: 3.8, height: 1, r: 0.5, hole: true },
];

const DRAWINGS: Record<InstrumentId, Drawing> = {
  // Acoustic: 3+3 pegs, round sound hole
  guitar: {
    length: 44.4,
    scale: 0.72,
    shapes: [
      { type: "rect", x: -3, y: 0, width: 6, height: 7.5, r: 1.6 },
      { type: "circle", cx: -4.1, cy: 1.6, r: 1.05 },
      { type: "circle", cx: 4.1, cy: 1.6, r: 1.05 },
      { type: "circle", cx: -4.1, cy: 3.8, r: 1.05 },
      { type: "circle", cx: 4.1, cy: 3.8, r: 1.05 },
      { type: "circle", cx: -4.1, cy: 6, r: 1.05 },
      { type: "circle", cx: 4.1, cy: 6, r: 1.05 },
      { type: "rect", x: -1.55, y: 7, width: 3.1, height: 18 },
      { type: "circle", cx: 0, cy: 27, r: 6.2 },
      { type: "circle", cx: 0, cy: 36.4, r: 8 },
      { type: "circle", cx: 0, cy: 29.6, r: 2.3, hole: true },
      { type: "rect", x: -3.4, y: 37.6, width: 6.8, height: 1.4, r: 0.7, hole: true },
    ],
  },
  // A small guitar: 2+2 pegs, short neck, drawn smaller than the guitar
  ukulele: {
    length: 37,
    scale: 0.72,
    shapes: [
      { type: "rect", x: -3, y: 0, width: 6, height: 6, r: 1.6 },
      { type: "circle", cx: -4.1, cy: 1.8, r: 1.1 },
      { type: "circle", cx: 4.1, cy: 1.8, r: 1.1 },
      { type: "circle", cx: -4.1, cy: 4.2, r: 1.1 },
      { type: "circle", cx: 4.1, cy: 4.2, r: 1.1 },
      { type: "rect", x: -1.8, y: 5.5, width: 3.6, height: 11 },
      { type: "circle", cx: 0, cy: 20.6, r: 6.4 },
      { type: "circle", cx: 0, cy: 29.2, r: 7.8 },
      { type: "circle", cx: 0, cy: 22.8, r: 2.4, hole: true },
      { type: "rect", x: -3.2, y: 30.4, width: 6.4, height: 1.4, r: 0.7, hole: true },
    ],
  },
  // Electric: 4 tuners in a row, long neck, offset body with a split pickup
  bass: {
    length: 49.6,
    scale: 0.66,
    shapes: [
      { type: "path", d: "M-1.6 0 H2.3 Q3 0 3 0.8 V10.5 H-1.6 Z" },
      { type: "circle", cx: -3, cy: 1.7, r: 1.15 },
      { type: "circle", cx: -3, cy: 4.2, r: 1.15 },
      { type: "circle", cx: -3, cy: 6.7, r: 1.15 },
      { type: "circle", cx: -3, cy: 9.2, r: 1.15 },
      { type: "rect", x: -1.45, y: 10, width: 2.9, height: 24.5 },
      {
        type: "path",
        d:
          "M-1.7 34 C-2.2 31.4 -3.5 28.3 -5.3 28.5 C-7.3 28.8 -7.6 32.4 -7.1 35.4 " +
          "C-8.7 40 -8.4 49.6 0 49.6 C8.4 49.6 8.7 43 7.5 38.6 " +
          "C6.7 35.3 7.4 30.5 5.4 30.2 C3.5 30 2.4 31.8 1.7 34 Z",
      },
      { type: "rect", x: -2.9, y: 37, width: 2.8, height: 1.5, r: 0.6, hole: true },
      { type: "rect", x: 0.2, y: 38.3, width: 2.8, height: 1.5, r: 0.6, hole: true },
      { type: "rect", x: -2.6, y: 44.2, width: 5.2, height: 1.4, r: 0.6, hole: true },
    ],
  },
  violin: { length: 42.8, scale: 0.75, shapes: BOWED_BODY },
  // The violin's shape on an endpin
  cello: {
    length: 50,
    scale: 0.65,
    shapes: [
      ...BOWED_BODY,
      { type: "rect", x: -0.55, y: 42.3, width: 1.1, height: 6.2 },
      { type: "path", d: "M-0.55 48.4 L0 50 L0.55 48.4 Z" },
    ],
  },
};

type Props = {
  instrument: InstrumentId;
  size: number;
  color: string;
  /** Background behind the icon: holes are painted in it. */
  holeColor: string;
};

function InstrumentIcon({ instrument, size, color, holeColor }: Props) {
  const { length, scale, shapes } = DRAWINGS[instrument];
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <G transform={`translate(16 16) rotate(45) scale(${scale}) translate(0 ${-length / 2})`}>
        {shapes.map((shape, i) => {
          const fill = shape.hole ? holeColor : color;
          switch (shape.type) {
            case "rect":
              return (
                <Rect
                  key={i}
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={shape.height}
                  rx={shape.r}
                  fill={fill}
                />
              );
            case "circle":
              return <Circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} fill={fill} />;
            case "ellipse":
              return (
                <Ellipse key={i} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={fill} />
              );
            case "path":
              return <Path key={i} d={shape.d} fill={fill} />;
          }
        })}
      </G>
    </Svg>
  );
}

export default memo(InstrumentIcon);
