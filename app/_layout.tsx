import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import "./i18n/i18n";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { languageRepo } from "@/utils/language";
import { useEffect, useState } from "react";

export const unstable_settings = {
  anchor: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // Pretendard
    PretendardThin: require("@/assets/fonts/pretendard/Pretendard-Thin.ttf"),
    PretendardLight: require("@/assets/fonts/pretendard/Pretendard-Light.ttf"),
    Pretendard: require("@/assets/fonts/pretendard/Pretendard-Regular.ttf"),
    PretendardMedium: require("@/assets/fonts/pretendard/Pretendard-Medium.ttf"),
    PretendardSemiBold: require("@/assets/fonts/pretendard/Pretendard-SemiBold.ttf"),
    PretendardBold: require("@/assets/fonts/pretendard/Pretendard-Bold.ttf"),

    // PretendardJP
    PretendardJPThin: require("@/assets/fonts/pretendardJP/PretendardJP-Thin.ttf"),
    PretendardJPLight: require("@/assets/fonts/pretendardJP/PretendardJP-Light.ttf"),
    PretendardJP: require("@/assets/fonts/pretendardJP/PretendardJP-Regular.ttf"),
    PretendardJPMedium: require("@/assets/fonts/pretendardJP/PretendardJP-Medium.ttf"),
    PretendardJPSemiBold: require("@/assets/fonts/pretendardJP/PretendardJP-SemiBold.ttf"),
    PretendardJPBold: require("@/assets/fonts/pretendardJP/PretendardJP-Bold.ttf"),
  });

  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await languageRepo.load();

      // 폰트 로딩 대기
      if (!loaded && !error) return;

      if (cancelled) return;

      setReady(true);
      await SplashScreen.hideAsync();
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded, error]);

  if (!ready) return null;

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: true }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
