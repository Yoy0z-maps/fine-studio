import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { authStorage, onboardingStorage } from "@/utils/authStorage";
import { userService } from "@/services/firebase/userService";
import { auth } from "@/services/firebase/config";
import { signOut as firebaseSignOut, onAuthStateChanged, User, deleteUser as firebaseDeleteUser } from "firebase/auth";
import { AuthUser, UserPlan } from "@/types/user";
import { router } from "expo-router";
import { signOutGoogle, configureGoogleSignIn } from "@/services/firebase/googleSignIn";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isOnboardingComplete: boolean;
  isPro: boolean;
  isTestMode: boolean;
  signIn: (user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  upgradeToPro: () => Promise<void>;
  enterTestMode: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);

  const isPro = user?.plan === "pro";

  const enterTestMode = () => {
    setIsTestMode(true);
  };

  // Firebase Auth 상태 변경 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
    });
    return unsubscribe;
  }, []);

  // Android: Google Sign-In 초기화
  useEffect(() => {
    if (Platform.OS === "android") {
      configureGoogleSignIn();
    }
  }, []);

  // 로컬 인증 상태 로드
  useEffect(() => {
    loadAuthState();
  }, []);

  // Firebase Auth가 인증되면 Firestore 동기화
  useEffect(() => {
    if (firebaseUser && user) {
      syncUserFromFirebase(firebaseUser.uid);
    }
  }, [firebaseUser, user?.id]);

  const loadAuthState = async () => {
    try {
      const [savedUser, onboardingComplete] = await Promise.all([
        authStorage.getUser(),
        onboardingStorage.isComplete(),
      ]);
      setUser(savedUser);
      setIsOnboardingComplete(onboardingComplete);
    } catch (error) {
      console.error("Failed to load auth state:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncUserFromFirebase = async (uid: string) => {
    // Firebase Auth가 인증된 상태에서만 Firestore 접근
    if (!firebaseUser) {
      return;
    }

    try {
      const firestoreUser = await userService.getUser(uid);
      if (firestoreUser) {
        const currentUser = await authStorage.getUser();
        if (currentUser && firestoreUser.plan !== currentUser.plan) {
          const updatedUser = { ...currentUser, plan: firestoreUser.plan };
          await authStorage.saveUser(updatedUser);
          setUser(updatedUser);
        }
      }
    } catch (error) {
      console.warn("Failed to sync with Firebase:", error);
    }
  };

  const signIn = async (newUser: AuthUser) => {
    // 로컬 저장
    await authStorage.saveUser(newUser);
    setUser(newUser);

    // Firebase Firestore에 사용자 생성/업데이트
    // (이 시점에서 Firebase Auth는 이미 로그인 화면에서 인증됨)
    try {
      const firestoreUser = await userService.createOrUpdateUser(newUser.id, {
        email: newUser.email,
        displayName: newUser.fullName,
        appleUserId: newUser.appleUserId,
        googleUserId: newUser.googleUserId,
        authProvider: newUser.authProvider || "apple",
      });

      // Firebase에서 plan 가져와서 동기화 (기존 사용자인 경우)
      if (firestoreUser.plan !== newUser.plan) {
        const updatedUser = { ...newUser, plan: firestoreUser.plan };
        await authStorage.saveUser(updatedUser);
        setUser(updatedUser);
      }
    } catch (error) {
      console.warn("Failed to sync user to Firebase:", error);
    }
  };

  const signOut = async () => {
    try {
      // Firebase Auth 로그아웃
      await firebaseSignOut(auth);
    } catch (error) {
      console.warn("Firebase signOut error:", error);
    }

    // Google Sign-Out (Android)
    if (Platform.OS === "android" && user?.authProvider === "google") {
      try {
        await signOutGoogle();
      } catch (error) {
        console.warn("Google signOut error:", error);
      }
    }

    // 로컬 스토리지 삭제
    await authStorage.removeUser();
    setUser(null);
    setFirebaseUser(null);
    setIsTestMode(false);

    // 로그인 화면으로 이동
    router.replace("/auth/login");
  };

  const deleteAccount = async () => {
    if (!user || !firebaseUser) return;

    try {
      // 1. Firestore 사용자 문서 삭제
      await userService.deleteUser(user.id);

      // 2. Firebase Auth 사용자 삭제
      await firebaseDeleteUser(firebaseUser);

      // 3. Google Sign-Out (Android)
      if (Platform.OS === "android" && user?.authProvider === "google") {
        try {
          await signOutGoogle();
        } catch (error) {
          console.warn("Google signOut error:", error);
        }
      }

      // 4. 로컬 스토리지 삭제
      await authStorage.removeUser();
      await onboardingStorage.reset();
      setUser(null);
      setFirebaseUser(null);
      setIsTestMode(false);

      // 5. 로그인 화면으로 이동
      router.replace("/auth/login");
    } catch (error) {
      console.error("Failed to delete account:", error);
      throw error;
    }
  };

  const completeOnboarding = async () => {
    await onboardingStorage.setComplete();
    setIsOnboardingComplete(true);
  };

  const upgradeToPro = async () => {
    if (!user || !firebaseUser) return;

    try {
      await userService.updatePlan(user.id, "pro");

      const updatedUser = { ...user, plan: "pro" as UserPlan };
      await authStorage.saveUser(updatedUser);
      setUser(updatedUser);
    } catch (error) {
      console.error("Failed to upgrade to pro:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isOnboardingComplete,
        isPro,
        isTestMode,
        signIn,
        signOut,
        deleteAccount,
        completeOnboarding,
        upgradeToPro,
        enterTestMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
