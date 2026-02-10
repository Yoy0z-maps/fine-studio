import { requireNativeView } from 'expo';
import * as React from 'react';

import { ExpoPcmStreamViewProps } from './ExpoPcmStream.types';

const NativeView: React.ComponentType<ExpoPcmStreamViewProps> =
  requireNativeView('ExpoPcmStream');

export default function ExpoPcmStreamView(props: ExpoPcmStreamViewProps) {
  return <NativeView {...props} />;
}
