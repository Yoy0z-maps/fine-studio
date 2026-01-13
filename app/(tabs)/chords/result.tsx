import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function ResultScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();

  // q는 string | undefined
  // 필요하면 안전하게 처리
  const query = (q ?? "").trim();

  // query로 API 호출/필터링
  return (
    <View>
      <Text>Result</Text>
    </View>
  );
}
