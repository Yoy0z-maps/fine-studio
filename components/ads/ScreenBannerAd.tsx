import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { getBannerAdUnitId, BannerAdScreen } from "@/utils/ads/adUnitIds";

type Props = {
  screen: BannerAdScreen;
};

export default function ScreenBannerAd({ screen }: Props) {
  const unitId = getBannerAdUnitId(screen);
  const [failed, setFailed] = useState(false);

  if (!unitId || failed) return null;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
  },
});
