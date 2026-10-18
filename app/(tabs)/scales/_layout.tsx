import LibraryGate from "@/components/LibraryGate";
import { Stack } from "expo-router";

export default function ScaleStackLayout() {
  return (
    <LibraryGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="[scaleId]" />
      </Stack>
    </LibraryGate>
  );
}
