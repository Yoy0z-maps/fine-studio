import { registerWebModule, NativeModule } from 'expo';

import { ExpoPcmStreamModuleEvents } from './ExpoPcmStream.types';

class ExpoPcmStreamModule extends NativeModule<ExpoPcmStreamModuleEvents> {
  start(_frameSize?: number): void {
    // Web implementation not supported
    this.emit('onError', { message: 'PCM streaming not supported on web' });
  }

  stop(): void {
    // No-op on web
  }
}

export default registerWebModule(ExpoPcmStreamModule, 'ExpoPcmStreamModule');
