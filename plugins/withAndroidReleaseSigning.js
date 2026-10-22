const { withAppBuildGradle } = require("expo/config-plugins");

// Signs release builds (./gradlew bundleRelease) with the Play upload key instead of the debug
// key the Expo template uses. Nothing secret lives in the repo: the keystore defaults to
// upload-key.jks in the project root, and the settings come from the project's .env (both
// git-ignored), e.g.:
//   FINE_STUDIO_UPLOAD_STORE_PASSWORD=...
//   FINE_STUDIO_UPLOAD_KEY_ALIAS=upload     (optional, default "upload")
//   FINE_STUDIO_UPLOAD_KEY_PASSWORD=...     (optional, defaults to the store password)
//   FINE_STUDIO_UPLOAD_STORE_FILE=...       (optional, another keystore path)
// A Gradle property (-P..., ~/.gradle/gradle.properties) or an environment variable of the same
// name takes precedence. No EXPO_PUBLIC_ prefix, so none of it reaches the JS bundle.
// Without a store password, release builds keep the debug key: fine for local testing, but
// Google Play rejects the bundle.
const MARKER = "// [withAndroidReleaseSigning]";

// Gradle reads the .env itself, so a plain ./gradlew run needs nothing exported.
const SETTING_HELPER = `${MARKER}
def fineStudioUploadSetting(String key) {
    def value = findProperty(key) ?: System.getenv(key)
    if (value) return value
    def envFile = rootProject.file("../.env")
    if (!envFile.exists()) return null
    def line = envFile.readLines().find { it.trim().startsWith(key + "=") }
    if (line == null) return null
    def raw = line.substring(line.indexOf("=") + 1).trim()
    if (raw.length() >= 2 && ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))) {
        raw = raw.substring(1, raw.length() - 1)
    }
    return raw ?: null
}

`;

const RELEASE_SIGNING_CONFIG = `
        release {
            if (fineStudioUploadSetting('FINE_STUDIO_UPLOAD_STORE_PASSWORD')) {
                storeFile file(fineStudioUploadSetting('FINE_STUDIO_UPLOAD_STORE_FILE') ?: "\${rootDir}/../upload-key.jks")
                storePassword fineStudioUploadSetting('FINE_STUDIO_UPLOAD_STORE_PASSWORD')
                keyAlias fineStudioUploadSetting('FINE_STUDIO_UPLOAD_KEY_ALIAS') ?: 'upload'
                keyPassword fineStudioUploadSetting('FINE_STUDIO_UPLOAD_KEY_PASSWORD') ?: fineStudioUploadSetting('FINE_STUDIO_UPLOAD_STORE_PASSWORD')
            }
        }`;

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;
    if (gradle.includes(MARKER)) return config;

    const androidBlock = /^android\s*\{/m;
    // The release signing config goes next to the template's debug one...
    const debugConfig = /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/;
    // ...and release builds use it when its password is set.
    const releaseUsesDebug = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!androidBlock.test(gradle) || !debugConfig.test(gradle) || !releaseUsesDebug.test(gradle)) {
      throw new Error("withAndroidReleaseSigning: app/build.gradle의 android/signingConfigs/buildTypes를 찾지 못했습니다.");
    }
    gradle = gradle.replace(androidBlock, (match) => SETTING_HELPER + match);
    gradle = gradle.replace(debugConfig, `$1${RELEASE_SIGNING_CONFIG}`);
    gradle = gradle.replace(
      releaseUsesDebug,
      "$1signingConfig fineStudioUploadSetting('FINE_STUDIO_UPLOAD_STORE_PASSWORD') ? signingConfigs.release : signingConfigs.debug"
    );
    config.modResults.contents = gradle;
    return config;
  });
};
