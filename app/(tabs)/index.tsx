import AppText from "@/components/AppText";
import { StyleSheet, View } from "react-native";

export default function TunerScreen() {
  return (
    <View>
      <AppText style={styles.text}>Tuner App</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 30,
    fontWeight: "600",
  },
});
