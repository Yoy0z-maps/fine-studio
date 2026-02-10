import { useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  requestTrackingPermissionsAsync,
  getTrackingPermissionsAsync,
  PermissionStatus,
} from "expo-tracking-transparency";

export function useTrackingPermission() {
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAndRequestPermission();
  }, []);

  const checkAndRequestPermission = async () => {
    // Android에서는 ATT가 필요 없음
    if (Platform.OS !== "ios") {
      setStatus(PermissionStatus.GRANTED);
      setIsLoading(false);
      return;
    }

    try {
      // 현재 권한 상태 확인
      const { status: currentStatus } = await getTrackingPermissionsAsync();

      if (currentStatus === PermissionStatus.UNDETERMINED) {
        // 아직 요청하지 않은 경우 권한 요청
        const { status: newStatus } = await requestTrackingPermissionsAsync();
        setStatus(newStatus);
      } else {
        setStatus(currentStatus);
      }
    } catch (error) {
      console.error("Failed to get tracking permission:", error);
      setStatus(PermissionStatus.DENIED);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermission = async () => {
    if (Platform.OS !== "ios") {
      return PermissionStatus.GRANTED;
    }

    try {
      const { status: newStatus } = await requestTrackingPermissionsAsync();
      setStatus(newStatus);
      return newStatus;
    } catch (error) {
      console.error("Failed to request tracking permission:", error);
      return PermissionStatus.DENIED;
    }
  };

  return {
    status,
    isLoading,
    isGranted: status === PermissionStatus.GRANTED,
    isDenied: status === PermissionStatus.DENIED,
    requestPermission,
  };
}
