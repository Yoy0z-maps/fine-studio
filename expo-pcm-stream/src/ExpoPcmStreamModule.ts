import { NativeModule, requireNativeModule } from 'expo';

import { ExpoPcmStreamModuleEvents } from './ExpoPcmStream.types';

declare class ExpoPcmStreamModule extends NativeModule<ExpoPcmStreamModuleEvents> {
  start(frameSize?: number): void;
  stop(): void;
}

export default requireNativeModule<ExpoPcmStreamModule>('ExpoPcmStream');
