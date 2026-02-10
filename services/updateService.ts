import * as Updates from "expo-updates";

export interface UpdateStatus {
  isChecking: boolean;
  isDownloading: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  error: string | null;
  manifest: Updates.Manifest | null;
}

export async function checkForUpdates(): Promise<{
  isAvailable: boolean;
  manifest: Updates.Manifest | null;
}> {
  if (__DEV__) {
    // Development 모드에서는 업데이트 체크 불가
    return { isAvailable: false, manifest: null };
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    return {
      isAvailable: update.isAvailable,
      manifest: update.manifest ?? null,
    };
  } catch (error) {
    console.error("Error checking for updates:", error);
    throw error;
  }
}

export async function downloadUpdate(): Promise<void> {
  if (__DEV__) {
    return;
  }

  try {
    await Updates.fetchUpdateAsync();
  } catch (error) {
    console.error("Error downloading update:", error);
    throw error;
  }
}

export async function reloadApp(): Promise<void> {
  if (__DEV__) {
    return;
  }

  try {
    await Updates.reloadAsync();
  } catch (error) {
    console.error("Error reloading app:", error);
    throw error;
  }
}

export function getUpdateInfo() {
  return {
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    updateId: Updates.updateId,
    channel: Updates.channel,
    runtimeVersion: Updates.runtimeVersion,
    createdAt: Updates.createdAt,
  };
}
