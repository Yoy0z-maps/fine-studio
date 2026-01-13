import { Colors } from "@/constants/theme";
// import { useColorScheme } from "@/hooks/use-color-scheme";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Tabs } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";

export default function TabLayout() {
  // const colorScheme = useColorScheme();
  const { t } = useTranslation("common");

  return (
    <Tabs
      screenOptions={{
        // tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        tabBarActiveTintColor: Colors.dark.tint,
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
          title: t("chords.title"),
          tabBarIcon: ({ color }) => (
            <Ionicons name="search" size={24} color={color} />
          ),
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
