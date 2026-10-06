import { NativeModule, requireNativeModule } from 'expo';

import { ExpoPcmStreamModuleEvents, PermissionStatus, PitchStreamOptions } from './ExpoPcmStream.types';

declare class ExpoPcmStreamModule extends NativeModule<ExpoPcmStreamModuleEvents> {
  /**
   * Starts the microphone and native pitch detection. Rejects with code `ERR_MIC_PERMISSION` when
   * the permission is denied (iOS asks for it first if undetermined). Resolves with null if a
   * stop() arrived while the iOS permission prompt was showing.
   */
  start(options?: PitchStreamOptions): Promise<{ sampleRate: number } | null>;
  stop(): Promise<void>;
  /** Changes the detection range of a running stream without restarting it. */
  setFrequencyRange(minFrequency: number, maxFrequency: number): void;
  /** iOS only - Android apps use PermissionsAndroid. */
  getPermissionStatus(): Promise<PermissionStatus>;
  /** iOS only - Android apps use PermissionsAndroid. */
  requestPermission(): Promise<PermissionStatus>;
}

export default requireNativeModule<ExpoPcmStreamModule>('ExpoPcmStream');
