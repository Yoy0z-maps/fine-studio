# expo-pcm-stream

Real-time microphone pitch detection for Expo and React Native. Both the audio capture and the pitch analysis run natively; JavaScript only receives one small result per analysis hop.

[한국어 문서](./README.ko.md)

## Features

- **Native McLeod Pitch Method (MPM)** with FFT-accelerated autocorrelation: Accelerate/vDSP on iOS and a precomputed-twiddle real FFT on Android. The Swift and Kotlin implementations produce identical results to machine precision.
- **Accurate on low strings.** A 35 Hz high-pass filter runs continuously over the stream. Restarting the filter for every window adds a transient that reads low notes several cents flat.
- **No phantom notes from hum.** Periodicity below the configured range, such as 50/60 Hz mains hum or room rumble, is rejected. It is not reported as a pitch pinned to the bottom of the range.
- **Low latency.**
  - iOS reads the microphone through an `AVAudioSinkNode` on the real-time I/O thread with ~5 ms hardware buffers. `installTap` only delivers 100–400 ms buffers.
  - Android records with `AudioRecord` (`VOICE_RECOGNITION` source, so AGC and noise suppression are off) at the device's native sample rate, on an urgent-audio thread.
- **Small events.** Each event is `{ frequency, clarity, rms }`, sent once per hop (default 1024 samples, ≈ 21 ms at 48 kHz). Raw audio never crosses the bridge.
- **Change the detection range while running** (for example, when switching between guitar and chromatic tuning modes) without restarting the stream.
- **Robust on iOS.** The stream resumes after interruptions (calls, Siri, alarms), audio route changes and media-server resets. When you stop it, the audio session is restored to the way it was found.

## Installation

```sh
npx expo install expo-pcm-stream
```

The package contains native code, so it doesn't run in Expo Go. Use a [development build](https://docs.expo.dev/develop/development-builds/introduction/): `npx expo run:ios`, `npx expo run:android`, or EAS Build.

### iOS

Add a microphone usage description to `app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSMicrophoneUsageDescription": "The tuner needs the microphone to hear your instrument."
      }
    }
  }
}
```

`start()` asks for the permission itself if it hasn't been decided yet.

### Android

The module's manifest declares `RECORD_AUDIO`. Request the permission at runtime (for example with `PermissionsAndroid`) before calling `start()`.

## Usage

```tsx
import ExpoPcmStream from 'expo-pcm-stream';
import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

export function usePitch() {
  const [frequency, setFrequency] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const subscription = ExpoPcmStream.addListener('onPitch', (event) => {
      // `clarity` is 0..1: how periodic (trustworthy) the reading is.
      setFrequency(event.frequency != null && event.clarity >= 0.8 ? event.frequency : null);
    });

    (async () => {
      if (Platform.OS === 'android') {
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (result !== PermissionsAndroid.RESULTS.GRANTED) return;
      }
      await ExpoPcmStream.start({ minFrequency: 65, maxFrequency: 1500 });
      // The component may have unmounted while start() was pending.
      if (!active) await ExpoPcmStream.stop();
    })().catch((error) => console.warn(error.code, error.message));

    return () => {
      active = false;
      subscription.remove();
      ExpoPcmStream.stop();
    };
  }, []);

  return frequency;
}
```

Stop the stream when your app goes to the background, for example from an `AppState` listener. Otherwise Android keeps recording (silence) and analyzing it in the background.

## API

### `start(options?: PitchStreamOptions): Promise<{ sampleRate: number } | null>`

Starts the microphone and native pitch detection. Calling it while the stream is already running restarts the stream with the new options.

| Option             | Default | Description                                                                 |
| ------------------ | ------- | --------------------------------------------------------------------------- |
| `windowSize`       | `2048`  | Analysis window in samples (256–16384). Needs at least ~2 periods of the lowest note. |
| `hopSize`          | `1024`  | Samples between analyses. One `onPitch` event is sent per hop.              |
| `minFrequency`     | `65`    | Lowest detectable frequency in Hz.                                          |
| `maxFrequency`     | `1500`  | Highest detectable frequency in Hz.                                         |
| `silenceThreshold` | `0.002` | Hops whose RMS is below this skip detection (`frequency` is `null`).        |

The promise resolves with the capture sample rate. On iOS it resolves with `null` if `stop()` was called while the permission prompt was showing.

The promise rejects with one of these error codes:

| Code                       | When                                                       |
| -------------------------- | ---------------------------------------------------------- |
| `ERR_MIC_PERMISSION`       | The microphone permission is denied.                       |
| `ERR_NO_AUDIO_INPUT`       | No audio input is available (iOS).                         |
| `ERR_AUDIO_START`          | The recorder or audio engine couldn't start (for example, during a phone call or while another app holds the microphone). |
| `ERR_PITCH_STREAM_OPTIONS` | The options are out of range.                              |
| `ERR_AUDIO_FORMAT`         | The input format is unsupported (iOS).                     |

### `stop(): Promise<void>`

Stops the stream and releases the microphone. No `onPitch` event is delivered after the promise resolves. On iOS, the audio session is handed back as it was found.

### `setFrequencyRange(minFrequency: number, maxFrequency: number): void`

Changes the detection range of a running stream without restarting it. (`start()` sets the range from its own options.)

### `getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'>` (iOS)

### `requestPermission(): Promise<'granted' | 'denied' | 'undetermined'>` (iOS)

On Android, use `PermissionsAndroid` instead.

### Events

```ts
ExpoPcmStream.addListener('onPitch', (event: PitchEvent) => {});
ExpoPcmStream.addListener('onPitchStreamError', (error: PitchStreamError) => {});
```

| `PitchEvent` field | Type             | Description                                                                         |
| ------------------ | ---------------- | ----------------------------------------------------------------------------------- |
| `frequency`        | `number \| null` | Detected fundamental in Hz. `null` while silent, filling the first window, or when the signal isn't periodic enough. |
| `clarity`          | `number`         | 0–1 confidence: the height of the chosen normalized-autocorrelation peak.          |
| `rms`              | `number`         | RMS level (0–1) of the latest hop, after the high-pass filter.                      |

`onPitchStreamError` (`{ code, message }`) fires when a running stream stops unexpectedly. For example, it fires if the stream couldn't be restarted after an interruption (iOS) or the recorder failed (Android).

## How it works

```
microphone ─► real-time callback ─► ring buffer ─► analysis thread ─► onPitch event
              (copy only; iOS)                     high-pass (continuous)
                                                   sliding window
                                                   MPM: autocorrelation via FFT,
                                                   NSDF, key-maximum peak picking,
                                                   parabolic interpolation
```

- **Peak picking.** The first NSDF key maximum within 93% of the highest one is chosen, which favors the fundamental over a stronger overtone. Detections whose peak clarity is below 0.5 are dropped.
- **Range edges.** A lobe that the lag range cuts off is followed past the range. If it keeps rising there, it belongs to a pitch below `minFrequency` and is ignored. A peak right at the top of the range is still refined by interpolation.
- **Measured accuracy.** These figures come from synthetic signals (pure tones, plucked-string models with inharmonicity, and noise):
  - Pure tones from 65 Hz to 1480 Hz read within 0.05 cents.
  - Simulated guitar strings read with 0.04 cents RMS error.
- **Speed.** One hop (filter, window and MPM at 2048 samples) takes ~15 µs on Apple Silicon (Swift/vDSP) and ~40 µs on a desktop JVM (Kotlin).

## Platform notes

### iOS

- **Audio session while running.** The session category is `.playAndRecord` with mode `.measurement` (minimal system input processing) and options `.defaultToSpeaker` and `.allowBluetoothA2DP`.
  - A2DP keeps Bluetooth headphones for playback only. The input stays on the built-in or wired microphone, because the HFP headset microphone is 8–16 kHz and voice-processed.
  - The preferred I/O buffer duration is 5 ms.
- **Audio session on stop.** The previous category, mode, options and buffer duration are restored. The session is deactivated with `.notifyOthersOnDeactivation`, so music that the microphone interrupted can resume. The session is not deactivated if another part of the app had already set up an active `.playback` session.

### Android

- **Audio source.** The Android CDD requires `VOICE_RECOGNITION` to have AGC and noise suppression disabled. Noise suppression otherwise treats a sustained note as noise and fades it out. `MIC` is the fallback.
- **Sample rate.** The device's native output sample rate is tried first, then 48 kHz, then 44.1 kHz.

## Example app

`example/` contains a minimal app that starts the stream and shows the readings.

## License

MIT
