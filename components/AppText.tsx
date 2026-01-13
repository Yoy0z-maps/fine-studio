import { useAppFonts } from "@/hooks/useAppFonts";
import { StyleSheet, Text, TextProps } from "react-native";

function pickFontFamily(
  base: "Pretendard" | "PretendardJP",
  weight?: string | number
) {
  const w = typeof weight === "string" ? parseInt(weight, 10) : weight ?? 400;

  if (w <= 200)
    return base === "Pretendard" ? "PretendardThin" : "PretendardJPThin";
  if (w <= 300)
    return base === "Pretendard" ? "PretendardLight" : "PretendardJPLight";
  if (w <= 400) return base;
  if (w <= 500)
    return base === "Pretendard" ? "PretendardMedium" : "PretendardJPMedium";
  if (w <= 600)
    return base === "Pretendard"
      ? "PretendardSemiBold"
      : "PretendardJPSemiBold";
  return base === "Pretendard" ? "PretendardBold" : "PretendardJPBold";
}

export default function AppText({ style, ...props }: TextProps) {
  const font = useAppFonts();

  const flat = StyleSheet.flatten(style) || {};
  const resultFont = pickFontFamily(font.sans as any, flat.fontWeight);

  return (
    <Text
      {...props}
      style={[style, { fontFamily: resultFont, fontWeight: undefined }]}
    />
  );
}
