import AppText from "@/components/AppText";
import { ThemeName, themes } from "@/constants/themes";
import { useAuth } from "@/contexts/AuthContext";
import { useColors, useTheme } from "@/contexts/ThemeContext";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { languageRepo } from "@/utils/language";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type LanguageCode = "en" | "ko" | "ja" | "zh";

const languages: { code: LanguageCode; labelKey: string }[] = [
  { code: "en", labelKey: "english" },
  { code: "ko", labelKey: "korean" },
  { code: "ja", labelKey: "japanese" },
  { code: "zh", labelKey: "chinese" },
];

// TODO: 실제 URL로 변경하세요
const TERMS_URL = "https://www.yoy0z-maps.com/fine-studio/terms-of-use";
const PRIVACY_URL = "https://www.yoy0z-maps.com/fine-studio/privacy";

export default function SettingsScreen() {
  const { t, i18n } = useTranslation("common");
  const { themeName, setTheme } = useTheme();
  const colors = useColors();
  const { user, signOut, deleteAccount, isPro } = useAuth();
  const { status, checkUpdate, downloadAndRestart, updateInfo } = useAppUpdate();

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  const handleLanguageChange = (code: LanguageCode) => {
    languageRepo.set(code);
  };

  const handleOpenTerms = () => {
    Linking.openURL(TERMS_URL);
  };

  const handleOpenPrivacy = () => {
    Linking.openURL(PRIVACY_URL);
  };

  const handleSignOut = () => {
    Alert.alert(
      t("settings.signOut"),
      t("settings.signOutConfirm"),
      [
        { text: t("settings.cancel"), style: "cancel" },
        { text: t("settings.signOut"), style: "destructive", onPress: signOut },
      ]
    );
  };

  const handleDeleteAccount = () => {
    const message = isPro
      ? t("settings.deleteAccountConfirmPro")
      : t("settings.deleteAccountConfirm");

    Alert.alert(
      t("settings.deleteAccount"),
      message,
      [
        { text: t("settings.cancel"), style: "cancel" },
        {
          text: t("settings.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (error) {
              Alert.alert(t("settings.error"), t("settings.deleteAccountFailed"));
            }
          },
        },
      ]
    );
  };

  const currentLanguage = i18n.language as LanguageCode;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Theme Section */}
        <View style={styles.section}>
          <AppText style={[styles.sectionTitle, { color: colors.text }]}>
            {t("settings.theme")}
          </AppText>
          <AppText
            style={[styles.sectionDescription, { color: colors.textSecondary }]}
          >
            {t("settings.themeDescription")}
          </AppText>

          <View style={styles.themeCards}>
            {(Object.keys(themes) as ThemeName[]).map((name) => {
              const theme = themes[name];
              const isSelected = themeName === name;
              return (
                <TouchableOpacity
                  key={name}
                  style={[
                    styles.themeCard,
                    { backgroundColor: colors.surface },
                    isSelected && {
                      borderColor: theme.colors.primary,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => setTheme(name)}
                >
                  <View style={styles.themePreview}>
                    <View
                      style={[
                        styles.previewHeader,
                        { backgroundColor: theme.colors.background },
                      ]}
                    />
                    <View style={styles.previewContent}>
                      <View
                        style={[
                          styles.previewAccent,
                          { backgroundColor: theme.colors.primary },
                        ]}
                      />
                      <View style={styles.previewBars}>
                        <View
                          style={[
                            styles.previewBar,
                            { backgroundColor: "#444" },
                          ]}
                        />
                        <View
                          style={[
                            styles.previewBar,
                            styles.previewBarShort,
                            { backgroundColor: "#333" },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                  <View style={styles.themeCardFooter}>
                    <AppText style={[styles.themeName, { color: colors.text }]}>
                      {t(`settings.${name}`)}
                    </AppText>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={theme.colors.primary}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <AppText style={[styles.sectionTitle, { color: colors.text }]}>
            {t("settings.language")}
          </AppText>
          <AppText
            style={[styles.sectionDescription, { color: colors.textSecondary }]}
          >
            {t("settings.languageDescription")}
          </AppText>

          <View
            style={[styles.languageList, { backgroundColor: colors.surface }]}
          >
            {languages.map((lang, index) => {
              const isSelected = currentLanguage === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageItem,
                    index < languages.length - 1 && styles.languageItemBorder,
                  ]}
                  onPress={() => handleLanguageChange(lang.code)}
                >
                  <AppText
                    style={[
                      styles.languageLabel,
                      { color: isSelected ? colors.primary : colors.text },
                    ]}
                  >
                    {t(`settings.${lang.labelKey}`)}
                  </AppText>
                  {isSelected && (
                    <Ionicons
                      name="checkmark"
                      size={22}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <AppText style={[styles.sectionTitle, { color: colors.text }]}>
            {t("settings.legal")}
          </AppText>

          <View style={[styles.legalList, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={[styles.legalItem, styles.legalItemBorder]}
              onPress={handleOpenTerms}
            >
              <AppText style={[styles.legalLabel, { color: colors.text }]}>
                {t("settings.termsOfUse")}
              </AppText>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.legalItem}
              onPress={handleOpenPrivacy}
            >
              <AppText style={[styles.legalLabel, { color: colors.text }]}>
                {t("settings.privacyPolicy")}
              </AppText>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* App Update Section */}
        <View style={styles.section}>
          <AppText style={[styles.sectionTitle, { color: colors.text }]}>
            {t("settings.appUpdate")}
          </AppText>
          <AppText
            style={[styles.sectionDescription, { color: colors.textSecondary }]}
          >
            {t("settings.currentVersion", { version: appVersion })}
          </AppText>

          <View style={[styles.updateContainer, { backgroundColor: colors.surface }]}>
            {status.isUpdateAvailable ? (
              <TouchableOpacity
                style={[styles.updateButton, { backgroundColor: colors.primary }]}
                onPress={downloadAndRestart}
                disabled={status.isDownloading}
              >
                {status.isDownloading ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <AppText style={styles.updateButtonText}>
                      {t("settings.downloading")}
                    </AppText>
                  </>
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color="#fff" />
                    <AppText style={styles.updateButtonText}>
                      {t("settings.updateNow")}
                    </AppText>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.checkUpdateButton, { borderColor: colors.border }]}
                onPress={checkUpdate}
                disabled={status.isChecking}
              >
                {status.isChecking ? (
                  <>
                    <ActivityIndicator size="small" color={colors.text} />
                    <AppText style={[styles.checkUpdateText, { color: colors.text }]}>
                      {t("settings.checking")}
                    </AppText>
                  </>
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={20} color={colors.text} />
                    <AppText style={[styles.checkUpdateText, { color: colors.text }]}>
                      {t("settings.checkForUpdates")}
                    </AppText>
                  </>
                )}
              </TouchableOpacity>
            )}
            {status.error && !__DEV__ && (
              <AppText style={[styles.errorText, { color: colors.red }]}>
                {status.error}
              </AppText>
            )}
            {!status.isUpdateAvailable && !status.isChecking && !status.error && (
              <AppText style={[styles.upToDateText, { color: colors.textSecondary }]}>
                {t("settings.upToDate")}
              </AppText>
            )}
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <AppText style={[styles.sectionTitle, { color: colors.text }]}>
            {t("settings.account")}
          </AppText>
          {user && (
            <AppText
              style={[styles.sectionDescription, { color: colors.textSecondary }]}
            >
              {user.email || user.fullName || (user.authProvider === "google" ? t("settings.googleUser") : t("settings.appleUser"))}
            </AppText>
          )}

          <TouchableOpacity
            style={[styles.signOutButton, { backgroundColor: colors.surface }]}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.red} />
            <AppText style={[styles.signOutText, { color: colors.red }]}>
              {t("settings.signOut")}
            </AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteAccountButton]}
            onPress={handleDeleteAccount}
          >
            <AppText style={[styles.deleteAccountText, { color: colors.textSecondary }]}>
              {t("settings.deleteAccount")}
            </AppText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  themeCards: {
    flexDirection: "row",
    gap: 12,
  },
  themeCard: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  themePreview: {
    height: 100,
    backgroundColor: "#151718",
  },
  previewHeader: {
    height: 20,
  },
  previewContent: {
    flex: 1,
    padding: 12,
    flexDirection: "row",
    gap: 12,
  },
  previewAccent: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  previewBars: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  previewBar: {
    height: 8,
    borderRadius: 4,
  },
  previewBarShort: {
    width: "60%",
  },
  themeCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  themeName: {
    fontSize: 15,
    fontWeight: "600",
  },
  languageList: {
    borderRadius: 12,
    overflow: "hidden",
  },
  languageItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  languageItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  languageLabel: {
    fontSize: 16,
  },
  legalList: {
    borderRadius: 12,
    overflow: "hidden",
  },
  legalItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  legalItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333",
  },
  legalLabel: {
    fontSize: 16,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "600",
  },
  deleteAccountButton: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 12,
  },
  deleteAccountText: {
    fontSize: 14,
    textDecorationLine: "underline",
  },
  updateContainer: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  updateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  checkUpdateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    width: "100%",
  },
  checkUpdateText: {
    fontSize: 16,
    fontWeight: "500",
  },
  errorText: {
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },
  upToDateText: {
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },
});
