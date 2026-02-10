import type { StyleProp, ViewStyle } from 'react-native';

export type AudioFrame = {
  sampleRate: number;
  frameSize: number;
  data: string; // Base64 encoded PCM data
};

export type AudioError = {
  message: string;
};

export type ExpoPcmStreamModuleEvents = {
  onAudioFrame: (frame: AudioFrame) => void;
  onError: (error: AudioError) => void;
};

// Legacy view types (kept for backward compatibility)
export type OnLoadEventPayload = {
  url: string;
};

export type ExpoPcmStreamViewProps = {
  url: string;
  onLoad: (event: { nativeEvent: OnLoadEventPayload }) => void;
  style?: StyleProp<ViewStyle>;
};
