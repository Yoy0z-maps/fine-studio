// app.json stays the static base config. This file only exists to inject
// AdMob app IDs from .env into the react-native-google-mobile-ads plugin —
// app.json is plain JSON and can't read process.env.
module.exports = ({ config }) => {
  const plugins = (config.plugins ?? []).map((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (name !== "react-native-google-mobile-ads") return plugin;

    return [
      "react-native-google-mobile-ads",
      {
        androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
        iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
      },
    ];
  });

  return {
    ...config,
    plugins,
  };
};
