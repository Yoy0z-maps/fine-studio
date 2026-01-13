import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function CodeDetailScreen() {
  const { codeId } = useLocalSearchParams<{ codeId?: string }>();

  return (
    <View>
      <Text>CodeId</Text>
    </View>
  );
}
