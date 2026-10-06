import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
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
import { ThemeName, defaultTheme } from "@/constants/themes";
import { useEffect, useState } from "react";
import { useTrackingPermission } from "@/hooks/useTrackingPermission";
import mobileAds from "react-native-google-mobile-ads";

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
  }, [user, isLoading, isOnboardingComplete, isTestMode, segments, router]);

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

  const colorScheme = useColorScheme();
  const [ready, setReady] = useState(false);

  // ATT(App Tracking Transparency) 권한 요청 - 앱 시작 시 자동으로 요청됨
  const { isLoading: isTrackingLoading } = useTrackingPermission();

  // ATT 응답이 확정된 후에 광고 SDK를 초기화 (Google 권장 순서)
  useEffect(() => {
    if (isTrackingLoading) return;
    mobileAds().initialize();
  }, [isTrackingLoading]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 폰트는 expo-font 플러그인으로 네이티브에 임베드되어 런타임 로딩이 필요 없다
      let savedTheme: ThemeName = defaultTheme;
      try {
        [savedTheme] = await Promise.all([
          themeStorage.load(),
          languageRepo.load(),
        ]);
      } catch (error) {
        // 저장소 오류가 나도 스플래시에서 멈추지 않고 기본값으로 시작한다
        console.warn("Failed to load saved preferences:", error);
      }

      if (cancelled) return;

      setInitialTheme(savedTheme);
      setReady(true);
      await SplashScreen.hideAsync();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
