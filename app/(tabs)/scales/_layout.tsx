import { Stack } from "expo-router";

export default function ScaleStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[scaleId]" />
    </Stack>
  );
}
