import { languageRepo } from "@/utils/language";
import { Button, Text, View } from "react-native";

export default function SettingsScreen() {
  const onPress = (string: "en" | "ko" | "ja" | "zh") => {
    languageRepo.set(string);
  };

  return (
    <View>
      <Text>Settings</Text>
      <Button onPress={() => onPress("en")} title="English" />
      <Button onPress={() => onPress("ko")} title="Korean" />
      <Button onPress={() => onPress("zh")} title="Chinese" />
      <Button onPress={() => onPress("ja")} title="Japanese" />
    </View>
  );
}
