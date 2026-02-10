import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import { UserProfile, UserPlan, AuthProvider } from "@/types/user";

const USERS_COLLECTION = "users";

/**
 * Firestore Timestamp을 Date로 변환
 */
function toDate(timestamp: Timestamp | Date | null): Date {
  if (!timestamp) return new Date();
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  return timestamp;
}

/**
 * Firebase 사용자 서비스
 */
export const userService = {
  /**
   * 사용자 조회
   */
  async getUser(uid: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, USERS_COLLECTION, uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        ...data,
        uid: docSnap.id,
        createdAt: toDate(data.createdAt),
        lastLoginAt: toDate(data.lastLoginAt),
      } as UserProfile;
    } catch (error) {
      console.error("Failed to get user:", error);
      return null;
    }
  },

  /**
   * 새 사용자 생성
   */
  async createUser(
    uid: string,
    data: {
      email: string | null;
      displayName: string | null;
      appleUserId?: string;
      googleUserId?: string;
      authProvider: AuthProvider;
    }
  ): Promise<UserProfile> {
    const userRef = doc(db, USERS_COLLECTION, uid);

    const newUser = {
      uid,
      email: data.email,
      displayName: data.displayName,
      authProvider: data.authProvider,
      plan: "standard" as const,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      settings: {},
      stats: {
        gamesPlayed: 0,
        correctAnswers: 0,
      },
      // undefined 값은 Firestore에 저장 불가하므로 조건부로 추가
      ...(data.appleUserId && { appleUserId: data.appleUserId }),
      ...(data.googleUserId && { googleUserId: data.googleUserId }),
    };

    await setDoc(userRef, newUser);

    return {
      ...newUser,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    } as UserProfile;
  },

  /**
   * 사용자 생성 또는 로그인 시간 업데이트
   */
  async createOrUpdateUser(
    uid: string,
    data: {
      email: string | null;
      displayName: string | null;
      appleUserId?: string;
      googleUserId?: string;
      authProvider: AuthProvider;
    }
  ): Promise<UserProfile> {
    const existingUser = await this.getUser(uid);

    if (existingUser) {
      // 기존 사용자 - 로그인 시간만 업데이트
      await this.updateLastLogin(uid);
      return {
        ...existingUser,
        lastLoginAt: new Date(),
      };
    }

    // 새 사용자 생성
    return this.createUser(uid, data);
  },

  /**
   * 마지막 로그인 시간 업데이트
   */
  async updateLastLogin(uid: string): Promise<void> {
    try {
      const userRef = doc(db, USERS_COLLECTION, uid);
      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to update last login:", error);
    }
  },

  /**
   * 플랜 업데이트 (인앱 결제 후 호출)
   */
  async updatePlan(uid: string, plan: UserPlan): Promise<void> {
    try {
      const userRef = doc(db, USERS_COLLECTION, uid);
      await updateDoc(userRef, { plan });
    } catch (error) {
      console.error("Failed to update plan:", error);
      throw error;
    }
  },

  /**
   * Pro 여부 확인
   */
  async isPro(uid: string): Promise<boolean> {
    const user = await this.getUser(uid);
    return user?.plan === "pro";
  },

  /**
   * 사용자 설정 업데이트
   */
  async updateSettings(
    uid: string,
    settings: Partial<UserProfile["settings"]>
  ): Promise<void> {
    try {
      const userRef = doc(db, USERS_COLLECTION, uid);
      await updateDoc(userRef, {
        [`settings.${Object.keys(settings)[0]}`]: Object.values(settings)[0],
      });
    } catch (error) {
      console.error("Failed to update settings:", error);
    }
  },

  /**
   * 게임 통계 업데이트
   */
  async incrementGameStats(uid: string, correct: boolean): Promise<void> {
    try {
      const user = await this.getUser(uid);
      if (!user) return;

      const userRef = doc(db, USERS_COLLECTION, uid);
      await updateDoc(userRef, {
        "stats.gamesPlayed": (user.stats?.gamesPlayed || 0) + 1,
        ...(correct && {
          "stats.correctAnswers": (user.stats?.correctAnswers || 0) + 1,
        }),
      });
    } catch (error) {
      console.error("Failed to update game stats:", error);
    }
  },

  /**
   * 사용자 삭제 (Firestore 문서만)
   */
  async deleteUser(uid: string): Promise<void> {
    try {
      const userRef = doc(db, USERS_COLLECTION, uid);
      await deleteDoc(userRef);
    } catch (error) {
      console.error("Failed to delete user document:", error);
      throw error;
    }
  },
};
