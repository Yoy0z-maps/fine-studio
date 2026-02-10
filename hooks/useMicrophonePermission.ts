import { useEffect, useState, useCallback } from "react";
import { Platform, PermissionsAndroid } from "react-native";

type PermissionStatus = "undetermined" | "granted" | "denied";

export function useMicrophonePermission() {
  const [status, setStatus] = useState<PermissionStatus>("undetermined");
  const [isLoading, setIsLoading] = useState(true);

  const checkPermission = useCallback(async () => {
    // iOS에서는 네이티브 모듈이 자동으로 권한 요청
    if (Platform.OS === "ios") {
      setStatus("granted");
      setIsLoading(false);
      return "granted";
    }

    try {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      const newStatus = result ? "granted" : "undetermined";
      setStatus(newStatus);
      setIsLoading(false);
      return newStatus;
    } catch (error) {
      console.error("Failed to check microphone permission:", error);
      setStatus("denied");
      setIsLoading(false);
      return "denied";
    }
  }, []);

  const requestPermission = useCallback(async () => {
    // iOS에서는 네이티브 모듈이 자동으로 권한 요청
    if (Platform.OS === "ios") {
      setStatus("granted");
      return "granted";
    }

    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: "마이크 권한 필요",
          message: "튜너 기능을 사용하려면 마이크 권한이 필요합니다.",
          buttonPositive: "허용",
          buttonNegative: "거부",
        }
      );

      const newStatus =
        result === PermissionsAndroid.RESULTS.GRANTED ? "granted" : "denied";
      setStatus(newStatus);
      return newStatus;
    } catch (error) {
      console.error("Failed to request microphone permission:", error);
      setStatus("denied");
      return "denied";
    }
  }, []);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return {
    status,
    isLoading,
    isGranted: status === "granted",
    isDenied: status === "denied",
    checkPermission,
    requestPermission,
  };
}
