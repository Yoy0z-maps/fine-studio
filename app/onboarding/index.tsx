import AppText from "@/components/AppText";
import { useColors } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import PagerView from "react-native-pager-view";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, G, Rect, Line } from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingPage {
  key: string;
  titleKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
}

export default function OnboardingScreen() {
  const { t } = useTranslation("common");
  const colors = useColors();
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const pages: OnboardingPage[] = [
    {
      key: "tuner",
      titleKey: "onboarding.tuner.title",
      descriptionKey: "onboarding.tuner.description",
      icon: (
        <Svg width={120} height={120} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={45} fill={colors.surface} />
          <Path
            d="M35 25 L35 50 Q35 58 45 62 L45 80 L55 80 L55 62 Q65 58 65 50 L65 25"
            fill="none"
            stroke={colors.primary}
            strokeWidth={5}
            strokeLinecap="round"
          />
          <Circle cx={50} cy={80} r={5} fill={colors.primary} />
        </Svg>
      ),
    },
    {
      key: "metronome",
      titleKey: "onboarding.metronome.title",
      descriptionKey: "onboarding.metronome.description",
      icon: (
        <Svg width={120} height={120} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={45} fill={colors.surface} />
          {/* Metronome body */}
          <Path
            d="M30 85 L40 25 L60 25 L70 85 Z"
            fill={colors.primary}
            opacity={0.3}
          />
          <Path
            d="M30 85 L40 25 L60 25 L70 85 Z"
            fill="none"
            stroke={colors.primary}
            strokeWidth={3}
          />
          {/* Pendulum */}
          <Line
            x1={50}
            y1={30}
            x2={35}
            y2={60}
            stroke={colors.primary}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Circle cx={35} cy={60} r={6} fill={colors.primary} />
        </Svg>
      ),
    },
    {
      key: "chords",
      titleKey: "onboarding.chords.title",
      descriptionKey: "onboarding.chords.description",
      icon: (
        <Svg width={120} height={120} viewBox="0 0 100 100">
          <Circle cx={50} cy={50} r={45} fill={colors.surface} />
          {/* Guitar fretboard */}
          <Rect x={25} y={20} width={50} height={60} rx={4} fill={colors.primary} opacity={0.2} />
          {/* Fret lines */}
          {[0, 15, 30, 45, 60].map((y, i) => (
            <Line
              key={i}
              x1={25}
              y1={20 + y}
              x2={75}
              y2={20 + y}
              stroke={colors.primary}
              strokeWidth={2}
            />
          ))}
          {/* Strings */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Line
              key={`s${i}`}
              x1={30 + i * 9}
              y1={20}
              x2={30 + i * 9}
              y2={80}
              stroke={colors.textSecondary}
              strokeWidth={1}
            />
          ))}
          {/* Finger positions */}
          <Circle cx={39} cy={42} r={5} fill={colors.primary} />
          <Circle cx={57} cy={57} r={5} fill={colors.primary} />
          <Circle cx={66} cy={57} r={5} fill={colors.primary} />
        </Svg>
      ),
    },
  ];

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      pagerRef.current?.setPage(currentPage + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    await completeOnboarding();
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        {currentPage < pages.length - 1 && (
          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <AppText style={[styles.skipText, { color: colors.textSecondary }]}>
              {t("onboarding.skip")}
            </AppText>
          </Pressable>
        )}
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
      >
        {pages.map((page) => (
          <View key={page.key} style={styles.page}>
            <View style={styles.iconContainer}>{page.icon}</View>
            <AppText style={[styles.title, { color: colors.text }]}>
              {t(page.titleKey)}
            </AppText>
            <AppText style={[styles.description, { color: colors.textSecondary }]}>
              {t(page.descriptionKey)}
            </AppText>
          </View>
        ))}
      </PagerView>

      {/* Page Indicators */}
      <View style={styles.indicators}>
        {pages.map((_, index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              {
                backgroundColor:
                  index === currentPage ? colors.primary : colors.surface,
                width: index === currentPage ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Next/Start Button */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.nextButton,
            { backgroundColor: colors.primary },
            pressed && styles.buttonPressed,
          ]}
          onPress={handleNext}
        >
          <AppText style={[styles.nextButtonText, { color: colors.background }]}>
            {currentPage === pages.length - 1
              ? t("onboarding.start")
              : t("onboarding.next")}
          </AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  skipButton: {
    padding: 8,
  },
  skipText: {
    fontSize: 16,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  indicators: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
  },
  indicator: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  nextButton: {
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
});
