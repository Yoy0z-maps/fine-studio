import * as React from 'react';

import { ExpoPcmStreamViewProps } from './ExpoPcmStream.types';

export default function ExpoPcmStreamView(props: ExpoPcmStreamViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
