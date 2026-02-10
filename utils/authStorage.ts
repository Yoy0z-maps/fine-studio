import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthUser, UserPlan } from "@/types/user";

const AUTH_KEY = "@fine_studio_auth";
const ONBOARDING_KEY = "@fine_studio_onboarding_complete";

// AuthUser를 re-export
export type { AuthUser };

export const authStorage = {
  async saveUser(user: AuthUser): Promise<void> {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
  },

  async getUser(): Promise<AuthUser | null> {
    const data = await AsyncStorage.getItem(AUTH_KEY);
    if (!data) return null;
    try {
      const user = JSON.parse(data) as AuthUser;
      // 기존 데이터 마이그레이션 (plan 필드 없는 경우)
      if (!user.plan) {
        user.plan = "standard";
      }
      return user;
    } catch {
      return null;
    }
  },

  async removeUser(): Promise<void> {
    await AsyncStorage.removeItem(AUTH_KEY);
  },

  async isLoggedIn(): Promise<boolean> {
    const user = await this.getUser();
    return user !== null;
  },

  async updatePlan(plan: UserPlan): Promise<void> {
    const user = await this.getUser();
    if (user) {
      user.plan = plan;
      await this.saveUser(user);
    }
  },
};

export const onboardingStorage = {
  async isComplete(): Promise<boolean> {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === "true";
  },

  async setComplete(): Promise<void> {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
  },

  async reset(): Promise<void> {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  },
};
