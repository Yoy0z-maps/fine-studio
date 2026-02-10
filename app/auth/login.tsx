import AppText from "@/components/AppText";
import { useColors } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { AuthUser } from "@/types/user";
import { auth } from "@/services/firebase/config";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { OAuthProvider, signInWithCredential } from "firebase/auth";
import { useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, G } from "react-native-svg";
import {
  signInWithGoogle,
  configureGoogleSignIn,
} from "@/services/firebase/googleSignIn";

export default function LoginScreen() {
  const { t } = useTranslation("common");
  const colors = useColors();
  const router = useRouter();
  const { signIn, isOnboardingComplete, enterTestMode } = useAuth();
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
  const [isGoogleConfigured, setIsGoogleConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 테스트 모드: 로고 5번 클릭
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogoTap = () => {
    tapCountRef.current += 1;

    // 타이머 리셋 (2초 내에 5번 클릭해야 함)
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
    }
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 2000);

    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      // 테스트 모드로 진입
      enterTestMode();
      router.replace("/(tabs)");
    }
  };

  useEffect(() => {
    if (Platform.OS === "ios") {
      checkAppleAuthAvailability();
    } else if (Platform.OS === "android") {
      const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      if (webClientId) {
        configureGoogleSignIn();
        setIsGoogleConfigured(true);
      }
    }
  }, []);

  const checkAppleAuthAvailability = async () => {
    const available = await AppleAuthentication.isAvailableAsync();
    setIsAppleAuthAvailable(available);
  };

  const handleAppleSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      // 1. Nonce 생성 (보안용)
      const rawNonce = await Crypto.randomUUID();
      const nonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      // 2. Apple Sign-In (nonce를 SHA256 해시로 전달)
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });

      // 3. Firebase Auth에 Apple credential로 로그인
      const provider = new OAuthProvider("apple.com");
      const oauthCredential = provider.credential({
        idToken: appleCredential.identityToken!,
        rawNonce: rawNonce, // 원본 nonce 사용
      });

      const firebaseUserCredential = await signInWithCredential(auth, oauthCredential);
      const firebaseUser = firebaseUserCredential.user;

      // 4. AuthUser 객체 생성 (Firebase UID 사용)
      const user: AuthUser = {
        id: firebaseUser.uid,
        email: appleCredential.email || firebaseUser.email,
        fullName: appleCredential.fullName
          ? `${appleCredential.fullName.givenName || ""} ${appleCredential.fullName.familyName || ""}`.trim()
          : firebaseUser.displayName,
        appleUserId: appleCredential.user,
        authProvider: "apple",
        plan: "standard",
      };

      // 5. 앱 내 로그인 처리
      await signIn(user);

      // 6. 네비게이션
      if (!isOnboardingComplete) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      console.error("Sign in error:", error);
      if (error.code === "ERR_REQUEST_CANCELED") {
        return;
      }
      Alert.alert(t("auth.error"), t("auth.signInFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const { authUser } = await signInWithGoogle();

      // 앱 내 로그인 처리
      await signIn(authUser);

      // 네비게이션
      if (!isOnboardingComplete) {
        router.replace("/onboarding");
      } else {
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      console.error("Google Sign in error:", error);
      if (error.code === "ERR_REQUEST_CANCELED") {
        return;
      }
      Alert.alert(t("auth.error"), t("auth.signInFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const renderAuthButton = () => {
    if (Platform.OS === "ios") {
      if (isAppleAuthAvailable) {
        return (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={12}
            style={[styles.authButton, isLoading && styles.buttonDisabled]}
            onPress={handleAppleSignIn}
          />
        );
      }
      return (
        <View style={[styles.unavailableContainer, { backgroundColor: colors.surface }]}>
          <AppText style={[styles.unavailableText, { color: colors.textSecondary }]}>
            {t("auth.appleSignInUnavailable")}
          </AppText>
        </View>
      );
    }

    // Android - Google Sign-In
    if (!isGoogleConfigured) {
      return (
        <View style={[styles.unavailableContainer, { backgroundColor: colors.surface }]}>
          <AppText style={[styles.unavailableText, { color: colors.textSecondary }]}>
            {t("auth.googleSignInUnavailable")}
          </AppText>
        </View>
      );
    }

    return (
      <Pressable
        style={[
          styles.googleButton,
          { backgroundColor: colors.background, borderColor: colors.border },
          isLoading && styles.buttonDisabled,
        ]}
        onPress={handleGoogleSignIn}
        disabled={isLoading}
      >
        <Svg width={20} height={20} viewBox="0 0 48 48">
          <Path
            fill="#FFC107"
            d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
          />
          <Path
            fill="#FF3D00"
            d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
          />
          <Path
            fill="#4CAF50"
            d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
          />
          <Path
            fill="#1976D2"
            d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
          />
        </Svg>
        <AppText style={[styles.googleButtonText, { color: colors.text }]}>
          {t("auth.signInWithGoogle")}
        </AppText>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Pressable style={styles.logoContainer} onPress={handleLogoTap}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            <Svg width={80} height={80} viewBox="0 0 100 100">
              <G>
                <Path
                  d="M35 20 L35 50 Q35 60 45 65 L45 85 L55 85 L55 65 Q65 60 65 50 L65 20"
                  fill="none"
                  stroke={colors.background}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx={50} cy={85} r={6} fill={colors.background} />
              </G>
            </Svg>
          </View>
        </Pressable>

        <AppText style={[styles.appName, { color: colors.text }]}>
          Fine Studio
        </AppText>
        <AppText style={[styles.tagline, { color: colors.textSecondary }]}>
          {t("auth.tagline")}
        </AppText>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.surface }]}>
              <AppText style={styles.featureEmoji}>🎸</AppText>
            </View>
            <AppText style={[styles.featureText, { color: colors.text }]}>
              {t("auth.feature1")}
            </AppText>
          </View>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.surface }]}>
              <AppText style={styles.featureEmoji}>🎵</AppText>
            </View>
            <AppText style={[styles.featureText, { color: colors.text }]}>
              {t("auth.feature2")}
            </AppText>
          </View>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.surface }]}>
              <AppText style={styles.featureEmoji}>🎼</AppText>
            </View>
            <AppText style={[styles.featureText, { color: colors.text }]}>
              {t("auth.feature3")}
            </AppText>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        {renderAuthButton()}

        <AppText style={[styles.termsText, { color: colors.textSecondary }]}>
          {t("auth.termsNotice")}
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    marginBottom: 48,
    textAlign: "center",
  },
  features: {
    width: "100%",
    gap: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureText: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: "center",
  },
  authButton: {
    width: "100%",
    height: 56,
  },
  googleButton: {
    width: "100%",
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  googleButtonText: {
    fontSize: 17,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  unavailableContainer: {
    width: "100%",
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  unavailableText: {
    fontSize: 14,
  },
  termsText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
});
