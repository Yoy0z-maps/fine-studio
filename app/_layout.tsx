import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import "./i18n/i18n";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { languageRepo } from "@/utils/language";
import { themeStorage } from "@/utils/themeStorage";
import { AppThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeName } from "@/constants/themes";
import { useEffect, useState } from "react";
import { useTrackingPermission } from "@/hooks/useTrackingPermission";

export const unstable_settings = {
  anchor: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, isLoading, isOnboardingComplete, isTestMode } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "auth";
    const inOnboardingGroup = segments[0] === "onboarding";

    if (!user && !isTestMode) {
      // 로그인되지 않은 경우 → 로그인 화면으로 (테스트 모드 제외)
      if (!inAuthGroup) {
        router.replace("/auth/login");
      }
    } else if (!isOnboardingComplete && !isTestMode) {
      // 로그인되었지만 온보딩 미완료 → 온보딩으로
      if (!inOnboardingGroup) {
        router.replace("/onboarding");
      }
    } else {
      // 로그인되고 온보딩 완료 → 메인 화면으로
      if (inAuthGroup || inOnboardingGroup) {
        router.replace("/(tabs)");
      }
    }
  }, [user, isLoading, isOnboardingComplete, segments]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [initialTheme, setInitialTheme] = useState<ThemeName | null>(null);
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

  // ATT(App Tracking Transparency) 권한 요청 - 앱 시작 시 자동으로 요청됨
  useTrackingPermission();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [savedTheme] = await Promise.all([
        themeStorage.load(),
        languageRepo.load(),
      ]);

      // 폰트 로딩 대기
      if (!loaded && !error) return;

      if (cancelled) return;

      setInitialTheme(savedTheme);
      setReady(true);
      await SplashScreen.hideAsync();
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded, error]);

  if (!ready || !initialTheme) return null;

  return (
    <AuthProvider>
      <AppThemeProvider initialTheme={initialTheme}>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <RootLayoutNav />
          <StatusBar style="auto" />
        </ThemeProvider>
      </AppThemeProvider>
    </AuthProvider>
  );
}
