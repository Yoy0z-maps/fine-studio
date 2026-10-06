import { FontBase, useAppFonts } from "@/hooks/useAppFonts";
import { StyleSheet, Text, TextProps } from "react-native";

// Fonts are embedded natively by the expo-font config plugin (app.json) and referenced by their
// PostScript names, which iOS resolves directly and Android finds as assets/fonts/<name>.ttf.
// Nothing is loaded at startup. Only the weights the app uses are shipped (400-700).
const NAMED_WEIGHTS: Record<string, number> = {
  ultralight: 100,
  thin: 200,
  light: 300,
  normal: 400,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  heavy: 800,
  black: 900,
};

function pickFontFamily(base: FontBase, weight?: string | number) {
  const w =
    weight === undefined
      ? 400
      : typeof weight === "number"
        ? weight
        : (NAMED_WEIGHTS[weight] ?? parseInt(weight, 10));

  if (!(w > 400)) return `${base}-Regular`; // also NaN
  if (w <= 500) return `${base}-Medium`;
  if (w <= 600) return `${base}-SemiBold`;
  return `${base}-Bold`;
}

export default function AppText({ style, ...props }: TextProps) {
  const font = useAppFonts();

  const flat = StyleSheet.flatten(style) || {};
  const resultFont = pickFontFamily(font.sans, flat.fontWeight);

  return (
    <Text
      {...props}
      style={[style, { fontFamily: resultFont, fontWeight: undefined }]}
    />
  );
}
