import { registerWebModule, NativeModule } from 'expo';

import { ExpoPcmStreamModuleEvents, PermissionStatus, PitchStreamOptions } from './ExpoPcmStream.types';

class ExpoPcmStreamModule extends NativeModule<ExpoPcmStreamModuleEvents> {
  async start(_options?: PitchStreamOptions): Promise<{ sampleRate: number } | null> {
    // Web implementation not supported
    this.emit('onPitchStreamError', {
      code: 'ERR_UNSUPPORTED_PLATFORM',
      message: 'Pitch streaming is not supported on web',
    });
    return null;
  }

  async stop(): Promise<void> {
    // No-op on web
  }

  setFrequencyRange(_minFrequency: number, _maxFrequency: number): void {
    // No-op on web
  }

  async getPermissionStatus(): Promise<PermissionStatus> {
    return 'denied';
  }

  async requestPermission(): Promise<PermissionStatus> {
    return 'denied';
  }
}

export default registerWebModule(ExpoPcmStreamModule, 'ExpoPcmStreamModule');
