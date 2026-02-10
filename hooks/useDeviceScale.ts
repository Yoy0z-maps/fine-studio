import { useWindowDimensions } from "react-native";

const TABLET_MIN_WIDTH = 768;

export function useDeviceScale() {
  const { width, height } = useWindowDimensions();

  // 가로/세로 중 작은 값으로 태블릿 판단 (회전 고려)
  const minDimension = Math.min(width, height);
  const isTablet = minDimension >= TABLET_MIN_WIDTH;

  // 태블릿에서는 1.4배, 폰에서는 1배
  const scale = isTablet ? 1.4 : 1;

  return {
    isTablet,
    scale,
    width,
    height,
  };
}
