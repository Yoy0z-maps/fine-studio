import ExpoPcmStream from "expo-pcm-stream";
import { useEffect, useState, useCallback, useRef } from "react";
import { AppState, Linking, Platform, PermissionsAndroid } from "react-native";

// "blocked": only the system Settings app can grant it anymore (any denial on iOS, which asks
// just once; "don't ask again" on Android).
type PermissionStatus = "undetermined" | "granted" | "denied" | "blocked";

export function useMicrophonePermission() {
  const [status, setStatus] = useState<PermissionStatus>("undetermined");
  const [isLoading, setIsLoading] = useState(true);
  const statusRef = useRef<PermissionStatus>("undetermined");

  const updateStatus = useCallback((newStatus: PermissionStatus) => {
    statusRef.current = newStatus;
    setStatus(newStatus);
    return newStatus;
  }, []);

  const checkPermission = useCallback(async () => {
    try {
      if (Platform.OS === "ios") {
        const native = await ExpoPcmStream.getPermissionStatus();
        return updateStatus(native === "denied" ? "blocked" : native);
      }

      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (granted) return updateStatus("granted");
      // check() can't tell "never asked" from "denied", so a denial already known stays put.
      const prev = statusRef.current;
      return updateStatus(prev === "denied" || prev === "blocked" ? prev : "undetermined");
    } catch (error) {
      console.error("Failed to check microphone permission:", error);
      return updateStatus("denied");
    } finally {
      setIsLoading(false);
    }
  }, [updateStatus]);

  const requestPermission = useCallback(async () => {
    try {
      if (Platform.OS === "ios") {
        const native = await ExpoPcmStream.requestPermission();
        return updateStatus(native === "denied" ? "blocked" : native);
      }

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "마이크 권한 필요",
          message: "튜너 기능을 사용하려면 마이크 권한이 필요합니다.",
          buttonPositive: "허용",
          buttonNegative: "거부",
        }
      );

      return updateStatus(
        result === PermissionsAndroid.RESULTS.GRANTED
          ? "granted"
          : result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
            ? "blocked"
            : "denied"
      );
    } catch (error) {
      console.error("Failed to request microphone permission:", error);
      return updateStatus("denied");
    }
  }, [updateStatus]);

  const openSettings = useCallback(() => Linking.openSettings(), []);

  useEffect(() => {
    checkPermission();
    // Picks up a change made in the Settings app (or the iOS system prompt being answered).
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") checkPermission();
    });
    return () => subscription.remove();
  }, [checkPermission]);

  return {
    status,
    isLoading,
    isGranted: status === "granted",
    isBlocked: status === "blocked",
    checkPermission,
    requestPermission,
    openSettings,
  };
}
