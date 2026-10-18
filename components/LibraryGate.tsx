import { useAuth } from "@/contexts/AuthContext";
import { useIsFocused } from "@react-navigation/native";
import { Redirect } from "expo-router";
import { ReactNode } from "react";

/**
 * The library is the one part of the app that needs an account. Its tab already opens the login
 * screen when tapped signed out; this covers the other ways in (a link straight to a chord or a
 * scale) by sending a signed-out visitor to the tuner. Only while the library is on screen, so
 * signing out in the settings doesn't pull the user out of the settings.
 */
export default function LibraryGate({ children }: { children: ReactNode }) {
  const { user, isTestMode, isLoading } = useAuth();
  const isFocused = useIsFocused();

  if (!isLoading && user == null && !isTestMode && isFocused) {
    return <Redirect href="/" />;
  }
  return <>{children}</>;
}
