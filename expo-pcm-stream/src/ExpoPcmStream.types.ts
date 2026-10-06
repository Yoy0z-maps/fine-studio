export type PitchEvent = {
  /** Detected fundamental in Hz, or null while silent, still filling the window, or not periodic enough. */
  frequency: number | null;
  /** 0..1 confidence of the detection (0 when `frequency` is null). */
  clarity: number;
  /** RMS level (0..1) of the latest hop, after the high-pass filter. */
  rms: number;
};

export type PitchStreamError = {
  code: string;
  message: string;
};

export type PitchStreamOptions = {
  /** Analysis window in samples. Default 2048. */
  windowSize?: number;
  /** Samples between analyses; one `onPitch` event is sent per hop. Default 1024. */
  hopSize?: number;
  /** Default 65 Hz. */
  minFrequency?: number;
  /** Default 1500 Hz. */
  maxFrequency?: number;
  /** Hops quieter than this RMS skip detection (`frequency` is null). Default 0.002. */
  silenceThreshold?: number;
};

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export type ExpoPcmStreamModuleEvents = {
  onPitch: (event: PitchEvent) => void;
  /** The stream stopped unexpectedly, e.g. it couldn't be restarted after an interruption. */
  onPitchStreamError: (error: PitchStreamError) => void;
};
