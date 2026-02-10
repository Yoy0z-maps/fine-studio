/**
 * Firebase Firestore에 저장되는 사용자 프로필
 */
export type UserPlan = "standard" | "pro";
export type AuthProvider = "apple" | "google";

export interface UserProfile {
  // 기본 정보
  uid: string;
  email: string | null;
  displayName: string | null;
  appleUserId?: string;
  googleUserId?: string;
  authProvider: AuthProvider;

  // 구독 플랜
  plan: UserPlan;

  // 타임스탬프
  createdAt: Date;
  lastLoginAt: Date;

  // 설정 (선택적)
  settings?: {
    theme?: string;
    language?: string;
  };

  // 통계 (선택적 - 나중에 확장)
  stats?: {
    gamesPlayed?: number;
    correctAnswers?: number;
  };
}

/**
 * 로컬에 저장되는 Auth 사용자 (기존 호환)
 */
export interface AuthUser {
  id: string;
  email: string | null;
  fullName: string | null;
  appleUserId?: string;
  googleUserId?: string;
  authProvider?: AuthProvider;
  plan: UserPlan;
}
