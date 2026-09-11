import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

const PRODUCTION_UNIT_IDS = {
  tuner: Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_TUNER,
    android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_TUNER,
  }),
  metronome: Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_METRONOME,
    android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_METRONOME,
  }),
};

export type BannerAdScreen = keyof typeof PRODUCTION_UNIT_IDS;

// Google policy requires test ad units for non-production builds - real units
// must only ever be requested from a build actually shipped to users.
export function getBannerAdUnitId(screen: BannerAdScreen): string | undefined {
  if (__DEV__) return TestIds.BANNER;
  return PRODUCTION_UNIT_IDS[screen];
}
