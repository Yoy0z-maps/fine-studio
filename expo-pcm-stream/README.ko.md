# expo-pcm-stream

Expo와 React Native에서 쓰는 실시간 마이크 피치 감지 모듈입니다. 오디오 캡처와 피치 분석을 모두 네이티브에서 처리하고, JavaScript로는 분석 홉마다 작은 결과 하나만 보냅니다.

[English](./README.md)

## 특징

- **네이티브 McLeod Pitch Method(MPM)**: 자기상관을 FFT로 계산합니다. iOS는 Accelerate/vDSP, Android는 트위들을 미리 계산한 실수 FFT를 씁니다. Swift와 Kotlin 구현은 머신 정밀도 수준에서 같은 결과를 냅니다.
- **저음현도 정확합니다.** 35Hz 하이패스 필터를 스트림 전체에 이어서 적용합니다. 윈도우마다 필터를 새로 시작하면 시작 과도응답 때문에 저음이 몇 센트씩 낮게 읽힙니다.
- **험(hum)으로 생기는 가짜 음이 없습니다.** 설정한 범위보다 낮은 주기성(50/60Hz 전원 험, 실내 저주파 소음 등)은 버립니다. 범위 하한에 붙은 가짜 음정으로 보고하지 않습니다.
- **지연이 짧습니다.**
  - iOS는 실시간 I/O 스레드의 `AVAudioSinkNode`로 마이크를 읽습니다. 하드웨어 버퍼는 약 5ms입니다. 반면 `installTap`은 100~400ms 단위로만 버퍼를 줍니다.
  - Android는 `AudioRecord`로 녹음합니다. `VOICE_RECOGNITION` 소스를 써서 AGC와 노이즈 억제가 꺼지고, 기기 기본 샘플레이트에서 URGENT_AUDIO 우선순위 스레드로 동작합니다.
- **이벤트가 작습니다.** 이벤트는 `{ frequency, clarity, rms }` 하나이고 홉마다 한 번 보냅니다(기본 1024샘플, 48kHz에서 약 21ms). 원본 오디오는 브리지를 건너지 않습니다.
- **실행 중에 감지 범위를 바꿀 수 있습니다.** 기타 모드와 크로매틱 모드를 오갈 때처럼 스트림을 재시작하지 않고 범위만 바꿉니다.
- **iOS에서 견고합니다.** 인터럽션(전화, Siri, 알람), 오디오 경로 변경, 미디어 서버 리셋 뒤에 자동으로 다시 시작합니다. 정지하면 오디오 세션을 처음 상태로 되돌립니다.

## 설치

```sh
npx expo install expo-pcm-stream
```

네이티브 코드가 들어 있어 Expo Go에서는 동작하지 않습니다. [개발 빌드](https://docs.expo.dev/develop/development-builds/introduction/)를 사용하세요. `npx expo run:ios`, `npx expo run:android`, EAS Build 모두 됩니다.

### iOS

`app.json`에 마이크 사용 목적 문구를 추가합니다.

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSMicrophoneUsageDescription": "악기 소리를 듣기 위해 마이크가 필요합니다."
      }
    }
  }
}
```

권한을 아직 정하지 않았다면 `start()`가 직접 요청합니다.

### Android

`RECORD_AUDIO`는 모듈 매니페스트에 이미 선언되어 있습니다. `start()`를 호출하기 전에 `PermissionsAndroid` 등으로 런타임 권한을 요청하세요.

## 사용법

```tsx
import ExpoPcmStream from 'expo-pcm-stream';
import { useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

export function usePitch() {
  const [frequency, setFrequency] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const subscription = ExpoPcmStream.addListener('onPitch', (event) => {
      // clarity는 0~1 값으로, 판독이 얼마나 주기적인지(믿을 만한지) 나타냅니다.
      setFrequency(event.frequency != null && event.clarity >= 0.8 ? event.frequency : null);
    });

    (async () => {
      if (Platform.OS === 'android') {
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (result !== PermissionsAndroid.RESULTS.GRANTED) return;
      }
      await ExpoPcmStream.start({ minFrequency: 65, maxFrequency: 1500 });
      // start()를 기다리는 동안 컴포넌트가 언마운트됐을 수 있습니다.
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

앱이 백그라운드로 가면 `AppState` 리스너 등에서 스트림을 멈추세요. 그러지 않으면 Android는 백그라운드에서도 무음을 계속 녹음하고 분석합니다.

## API

### `start(options?: PitchStreamOptions): Promise<{ sampleRate: number } | null>`

마이크와 네이티브 피치 감지를 시작합니다. 이미 실행 중일 때 다시 호출하면 새 옵션으로 재시작합니다.

| 옵션               | 기본값  | 설명                                                                    |
| ------------------ | ------- | ----------------------------------------------------------------------- |
| `windowSize`       | `2048`  | 분석 윈도우 크기(샘플, 256~16384). 가장 낮은 음의 주기가 2번 이상 들어가야 합니다. |
| `hopSize`          | `1024`  | 분석 간격(샘플). 홉마다 `onPitch` 이벤트를 하나 보냅니다.               |
| `minFrequency`     | `65`    | 감지할 최저 주파수(Hz)                                                  |
| `maxFrequency`     | `1500`  | 감지할 최고 주파수(Hz)                                                  |
| `silenceThreshold` | `0.002` | RMS가 이 값보다 작은 홉은 감지를 건너뜁니다(`frequency`가 `null`).      |

프로미스는 캡처 샘플레이트로 resolve됩니다. iOS에서 권한 창이 떠 있는 동안 `stop()`이 호출되면 `null`로 resolve됩니다.

실패하면 다음 에러 코드 중 하나로 reject됩니다.

| 코드                       | 상황                                                     |
| -------------------------- | -------------------------------------------------------- |
| `ERR_MIC_PERMISSION`       | 마이크 권한이 거부됨                                     |
| `ERR_NO_AUDIO_INPUT`       | 사용할 수 있는 오디오 입력이 없음(iOS)                   |
| `ERR_AUDIO_START`          | 녹음기나 오디오 엔진을 시작하지 못함(통화 중이거나 다른 앱이 마이크를 쓰는 경우 등) |
| `ERR_PITCH_STREAM_OPTIONS` | 옵션 값이 허용 범위를 벗어남                             |
| `ERR_AUDIO_FORMAT`         | 지원하지 않는 입력 포맷(iOS)                             |

### `stop(): Promise<void>`

스트림을 멈추고 마이크를 해제합니다. 프로미스가 resolve된 뒤에는 `onPitch` 이벤트가 오지 않습니다. iOS에서는 오디오 세션을 처음 상태로 돌려놓습니다.

### `setFrequencyRange(minFrequency: number, maxFrequency: number): void`

실행 중인 스트림의 감지 범위를 재시작 없이 바꿉니다. (`start()`는 자기 옵션으로 범위를 다시 설정합니다.)

### `getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'>` (iOS)

### `requestPermission(): Promise<'granted' | 'denied' | 'undetermined'>` (iOS)

Android에서는 `PermissionsAndroid`를 사용하세요.

### 이벤트

```ts
ExpoPcmStream.addListener('onPitch', (event: PitchEvent) => {});
ExpoPcmStream.addListener('onPitchStreamError', (error: PitchStreamError) => {});
```

| `PitchEvent` 필드 | 타입             | 설명                                                                              |
| ----------------- | ---------------- | --------------------------------------------------------------------------------- |
| `frequency`       | `number \| null` | 감지한 기본 주파수(Hz). 무음일 때, 첫 윈도우를 채우는 중일 때, 신호의 주기성이 부족할 때는 `null` |
| `clarity`         | `number`         | 0~1 신뢰도: 선택된 정규화 자기상관 피크의 높이                                   |
| `rms`             | `number`         | 하이패스 필터를 거친 최근 홉의 RMS 레벨(0~1)                                      |

`onPitchStreamError`(`{ code, message }`)는 실행 중이던 스트림이 예기치 않게 멈췄을 때 발생합니다. 예를 들어 iOS에서 인터럽션 뒤 재시작에 실패했거나 Android에서 녹음기 오류가 났을 때입니다.

## 동작 원리

```
마이크 ─► 실시간 콜백 ─► 링버퍼 ─► 분석 스레드 ─► onPitch 이벤트
         (iOS: 복사만)            하이패스(연속 적용)
                                  슬라이딩 윈도우
                                  MPM: FFT 자기상관, NSDF,
                                  키 맥시멈 피크 선택, 포물선 보간
```

- **피크 선택.** NSDF 키 맥시멈 중 최댓값의 93% 이상인 첫 피크를 고릅니다. 그래서 더 강한 배음보다 기본음을 우선합니다. 피크 신뢰도가 0.5 미만이면 감지 결과를 버립니다.
- **범위 경계 처리.** lag 범위 경계에서 잘린 로브는 범위 밖까지 따라가 봅니다. 그 너머에서 계속 올라가면 `minFrequency`보다 낮은 음이므로 무시합니다. 범위 상단 바로 위의 피크도 보간으로 정밀하게 보정합니다.
- **측정한 정확도.** 아래 수치는 합성 신호(순음, 비조화성을 넣은 발현 현 모델, 노이즈)로 측정한 값입니다.
  - 65~1480Hz 순음은 0.05센트 이내로 읽힙니다.
  - 기타 현 시뮬레이션은 RMS 오차 0.04센트입니다.
- **속도.** 2048샘플 기준으로 홉 하나(필터, 윈도우, MPM)를 처리하는 데 Apple Silicon(Swift/vDSP)에서 약 15µs, 데스크톱 JVM(Kotlin)에서 약 40µs가 걸립니다.

## 플랫폼별 참고

### iOS

- **실행 중 오디오 세션.** 카테고리는 `.playAndRecord`, 모드는 `.measurement`(시스템 입력 처리 최소화), 옵션은 `.defaultToSpeaker`와 `.allowBluetoothA2DP`입니다.
  - A2DP 옵션 덕분에 블루투스 헤드폰은 재생에만 쓰이고 입력은 내장/유선 마이크로 유지됩니다. HFP 헤드셋 마이크는 8~16kHz에 음성 처리가 들어가기 때문입니다.
  - 선호 I/O 버퍼 길이는 5ms입니다.
- **정지할 때 오디오 세션.** 이전 카테고리, 모드, 옵션, 버퍼 길이를 복원합니다. 그리고 `.notifyOthersOnDeactivation`으로 세션을 비활성화해서, 마이크 때문에 멈췄던 다른 앱의 음악이 다시 재생될 수 있게 합니다. 앱의 다른 부분이 이미 `.playback` 세션을 활성화해 둔 경우에는 비활성화하지 않습니다.

### Android

- **오디오 소스.** Android CDD는 `VOICE_RECOGNITION` 소스에서 AGC와 노이즈 억제를 끄도록 요구합니다. 노이즈 억제가 켜져 있으면 길게 울리는 음을 소음으로 보고 점점 줄여 버립니다. 이 소스를 쓸 수 없으면 `MIC`로 대체합니다.
- **샘플레이트.** 기기 기본 출력 샘플레이트를 먼저 시도하고, 그다음 48kHz, 44.1kHz 순으로 시도합니다.

## 예제 앱

`example/`에는 스트림을 시작하고 판독값을 보여 주는 최소한의 앱이 있습니다.

## 라이선스

MIT
