import { Stack } from "expo-router";

export default function ChordStackLayout() {
  // router.push({ pathname: "/(tabs)/code/results", params: { q } })
  // router.push({ pathname: "/(tabs)/code/[codeId]", params: { codeId } })

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Codes" }} />
      <Stack.Screen name="result" options={{ title: "Search Results" }} />
      <Stack.Screen name="[codeId]" options={{ title: "Code" }} />
    </Stack>
  );
}
