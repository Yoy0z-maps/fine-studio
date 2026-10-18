import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useIsFocused } from "@react-navigation/native";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/contexts/ThemeContext";

export default function TabLayout() {
  const { t } = useTranslation("common");
  const colors = useColors();
  const router = useRouter();
  const { user, isTestMode, isLoading: isAuthLoading } = useAuth();
  const canUseLibrary = user != null || isTestMode;

  // The library is the one part that needs an account: tapping its tab while signed out opens
  // the login screen instead, and the library once the login goes through and the login screen
  // has closed (switching tabs underneath the modal would race its dismissal).
  const isFocused = useIsFocused();
  const libraryAfterLoginRef = useRef(false);
  useEffect(() => {
    if (canUseLibrary && isFocused && libraryAfterLoginRef.current) {
      libraryAfterLoginRef.current = false;
      router.navigate("/chords");
    }
  }, [canUseLibrary, isFocused, router]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tuner.title"),
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons
              name="guitar-electric"
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="metronome"
        options={{
          title: t("metronome.title"),
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons
              name="metronome-tick"
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chords"
        options={{
          title: t("library.title"),
          tabBarIcon: ({ color }) => (
            <Ionicons name="musical-notes" size={24} color={color} />
          ),
        }}
        listeners={{
          tabPress: (event) => {
            if (canUseLibrary) return;
            event.preventDefault();
            // The saved login is still being read (the first instants after launch): don't ask
            // a signed-in user to log in again.
            if (isAuthLoading) return;
            libraryAfterLoginRef.current = true;
            router.push("/auth/login");
          },
        }}
      />
      <Tabs.Screen
        name="scales"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("settings.title"),
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings-sharp" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
