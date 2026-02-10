import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Tabs } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { useColors } from "@/contexts/ThemeContext";

export default function TabLayout() {
  const { t } = useTranslation("common");
  const colors = useColors();

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
