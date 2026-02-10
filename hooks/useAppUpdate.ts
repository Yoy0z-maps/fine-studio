import { useCallback, useEffect, useState } from "react";
import * as Updates from "expo-updates";
import {
  checkForUpdates,
  downloadUpdate,
  reloadApp,
  UpdateStatus,
} from "@/services/updateService";

interface UseAppUpdateReturn {
  status: UpdateStatus;
  checkUpdate: () => Promise<void>;
  downloadAndRestart: () => Promise<void>;
  updateInfo: {
    isEmbeddedLaunch: boolean;
    updateId: string | null;
    channel: string | null;
    runtimeVersion: string | null;
    createdAt: Date | null;
  };
}

export function useAppUpdate(checkOnMount = false): UseAppUpdateReturn {
  const [status, setStatus] = useState<UpdateStatus>({
    isChecking: false,
    isDownloading: false,
    isUpdateAvailable: false,
    isUpdatePending: false,
    error: null,
    manifest: null,
  });

  const checkUpdate = useCallback(async () => {
    if (__DEV__) {
      setStatus((prev) => ({
        ...prev,
        error: "Updates are not available in development mode",
      }));
      return;
    }

    setStatus((prev) => ({
      ...prev,
      isChecking: true,
      error: null,
    }));

    try {
      const { isAvailable, manifest } = await checkForUpdates();
      setStatus((prev) => ({
        ...prev,
        isChecking: false,
        isUpdateAvailable: isAvailable,
        manifest,
      }));
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        isChecking: false,
        error: error instanceof Error ? error.message : "Failed to check for updates",
      }));
    }
  }, []);

  const downloadAndRestart = useCallback(async () => {
    if (__DEV__) {
      return;
    }

    setStatus((prev) => ({
      ...prev,
      isDownloading: true,
      error: null,
    }));

    try {
      await downloadUpdate();
      setStatus((prev) => ({
        ...prev,
        isDownloading: false,
        isUpdatePending: true,
      }));
      // 다운로드 완료 후 앱 재시작
      await reloadApp();
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        isDownloading: false,
        error: error instanceof Error ? error.message : "Failed to download update",
      }));
    }
  }, []);

  // 마운트 시 자동 체크 (옵션)
  useEffect(() => {
    if (checkOnMount && !__DEV__) {
      checkUpdate();
    }
  }, [checkOnMount, checkUpdate]);

  const updateInfo = {
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    updateId: Updates.updateId,
    channel: Updates.channel,
    runtimeVersion: Updates.runtimeVersion,
    createdAt: Updates.createdAt,
  };

  return {
    status,
    checkUpdate,
    downloadAndRestart,
    updateInfo,
  };
}
