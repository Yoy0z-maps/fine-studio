import { Stack } from "expo-router";

export default function ChordStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[codeId]" />
      <Stack.Screen name="scale/[scaleId]" />
    </Stack>
  );
}
