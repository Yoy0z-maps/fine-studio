/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

// const tintColorLight = '#0a7ea4';
const tintColorDark = "#00E676";

export const Colors = {
  // light: {
  //   text: '#11181C',
  //   background: '#fff',
  //   tint: tintColorLight,
  //   icon: '#687076',
  //   tabIconDefault: '#687076',
  //   tabIconSelected: tintColorLight,
  // },
  dark: {
    text: "#fff",
    background: "#151718",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
    red: "#FF1744",
    yellow: "#FFD601",
    darkGray: "#424242",
  },
};

// Pretendard폰트만을 공통적으로 사용합니다
export const Fonts = {
  weight: {
    thin: "100",
    light: "300",
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },

  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
};
