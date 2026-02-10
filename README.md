# Fine Studio

기타리스트를 위한 올인원 연습 앱 - 튜너, 메트로놈, 코드 라이브러리

## 개요

Fine Studio는 Expo + React Native로 개발된 기타 연습 앱입니다. 정밀한 튜너, 커스터마이징 가능한 메트로놈, 99,000개 이상의 코드를 포함한 코드 라이브러리를 제공합니다.

### 주요 기능

- **튜너**: 실시간 피치 감지, 크로마틱/스탠다드 모드
- **메트로놈**: 가변 템포, 박자, 서브디비전, 악센트 지원
- **코드 라이브러리**: 검색, 즐겨찾기, 상세 운지법 표시
- **다국어 지원**: 영어, 한국어, 일본어, 중국어

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Expo SDK ~54.0.31, React Native 0.81.5 |
| Language | TypeScript, Swift (iOS), Kotlin (Android) |
| Navigation | Expo Router (File-based) |
| State | React Context |
| Auth | Firebase Auth (Apple Sign-In, Google Sign-In) |
| Database | Firebase Firestore |
| Styling | StyleSheet, React Native SVG |
| i18n | react-i18next |

---

## 프로젝트 구조

```
fine-studio/
├── app/                          # Expo Router 페이지
│   ├── (tabs)/                   # 탭 네비게이션
│   │   ├── index.tsx             # 튜너
│   │   ├── metronome.tsx         # 메트로놈
│   │   ├── chords/               # 코드 라이브러리
│   │   └── settings.tsx          # 설정
│   ├── auth/                     # 인증 화면
│   ├── onboarding/               # 온보딩
│   ├── i18n/                     # 다국어 설정
│   └── _layout.tsx               # 루트 레이아웃
├── components/                   # 공통 컴포넌트
├── contexts/                     # React Context
│   ├── AuthContext.tsx           # 인증 상태
│   └── ThemeContext.tsx          # 테마 상태
├── services/                     # 외부 서비스
│   └── firebase/
│       ├── config.ts             # Firebase 설정
│       ├── userService.ts        # Firestore 유저 CRUD
│       └── googleSignIn.ts       # Google Sign-In
├── hooks/                        # 커스텀 훅
├── utils/                        # 유틸리티 함수
├── types/                        # TypeScript 타입
├── constants/                    # 상수 (테마 등)
├── assets/                       # 정적 리소스
│   ├── fonts/                    # Pretendard 폰트
│   ├── data/chords/              # 코드 JSON 데이터
│   └── sounds/                   # 사운드 파일
├── expo-metronome/               # 메트로놈 네이티브 모듈
│   ├── ios/                      # Swift 구현
│   └── android/                  # Kotlin 구현
└── expo-pcm-stream/              # PCM 오디오 스트림 모듈
    ├── ios/                      # Swift 구현
    └── android/                  # Kotlin 구현
```

---

## 환경 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사하여 `.env` 파일 생성:

```bash
cp .env.example .env
```

`.env` 파일 내용:

```env
# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Google Sign-In (Android)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_client_id.apps.googleusercontent.com
```

### 3. Firebase 설정

#### iOS (Apple Sign-In)
1. Firebase Console → Authentication → Sign-in method → Apple 활성화
2. Apple Developer에서 Sign In with Apple capability 추가

#### Android (Google Sign-In)
1. Firebase Console → Authentication → Sign-in method → Google 활성화
2. Firebase Console → Project Settings → Android 앱 추가
3. SHA-1 인증서 지문 등록:
   ```bash
   cd android && ./gradlew signingReport
   ```
4. `google-services.json` 다운로드 → `android/app/` 배치
5. Google Cloud Console에서 Web Client ID 확인 → `.env`에 설정

---

## 네이티브 모듈

### expo-metronome

정밀한 타이밍의 메트로놈 모듈.

**기술 구현:**
- iOS: AVAudioEngine + DispatchSourceTimer
- Android: AudioTrack (MODE_STATIC) + HandlerThread

**API:**
```typescript
import ExpoMetronome from 'expo-metronome';

// 시작
ExpoMetronome.start(bpm: number, beats: number, soundEnabled: boolean, accentEnabled: boolean);

// 정지
ExpoMetronome.stop();

// 설정 변경
ExpoMetronome.setTempo(bpm: number);
ExpoMetronome.setBeats(beats: number);
ExpoMetronome.setSubdivision(sub: number);  // 1=quarter, 2=eighth, 4=sixteenth
ExpoMetronome.setSoundEnabled(enabled: boolean);
ExpoMetronome.setAccentEnabled(enabled: boolean);

// 이벤트
ExpoMetronome.addListener('onBeat', ({ beat, isAccent, tempo, subBeat }) => {});
```

### expo-pcm-stream

마이크 PCM 오디오 스트림 모듈 (튜너용).

**기술 구현:**
- iOS: AVAudioEngine InputNode Tap
- Android: AudioRecord (44100Hz, Mono, 16bit)

**API:**
```typescript
import ExpoPcmStream from 'expo-pcm-stream';

// 시작
ExpoPcmStream.start(frameSize?: number);  // 기본값 1024

// 정지
ExpoPcmStream.stop();

// 이벤트
ExpoPcmStream.addListener('onAudioFrame', ({ sampleRate, frameSize, data }) => {
  // data: Base64 인코딩된 Int16 PCM 데이터
});

ExpoPcmStream.addListener('onError', ({ message }) => {});
```

---

## 빌드 및 실행

### Development Build (로컬)

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

### Prebuild + IDE

네이티브 모듈 디버깅이 필요한 경우:

```bash
# Prebuild
npx expo prebuild --clean

# iOS - Xcode
xed ios

# Android - Android Studio
open -a "Android Studio" android
```

### EAS Build

```bash
# 개발 빌드
eas build --profile development --platform ios
eas build --profile development --platform android

# 프로덕션 빌드
eas build --profile production --platform ios
eas build --profile production --platform android
```

---

## 인증 흐름

### iOS (Apple Sign-In)
```
Apple Sign-In → Firebase Auth (OAuthProvider) → Firestore 유저 생성
```

### Android (Google Sign-In)
```
Google Sign-In → Firebase Auth (GoogleAuthProvider) → Firestore 유저 생성
```

### 테스트 모드
로그인 화면에서 **로고를 2초 내에 5번 탭**하면 로그인 없이 앱 사용 가능 (개발용).

---

## 다국어 지원

지원 언어: `en`, `ko`, `ja`, `zh`

번역 파일 위치: `app/i18n/locales/`

```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation('common');
t('settings.title');  // "Settings" 또는 "설정"
```

---

## 테마

두 가지 테마 지원: `green`, `coral`

```typescript
import { useColors, useTheme } from '@/contexts/ThemeContext';

const colors = useColors();
const { themeName, setTheme } = useTheme();
```

---

## 코드 데이터

99,230개의 기타 코드 JSON 데이터 포함.

출처: [T-vK/chord-collection](https://github.com/T-vK/chord-collection)

라이센스: MIT License (Copyright (c) 2019 Zoltán Szabó)

---

## 프로젝트 정보

- **Bundle ID**: `com.yoy0zmaps.finestudio`
- **EAS Project ID**: `6b77f879-c522-47ca-be36-eebeeb29d945`

---

## 라이센스

MIT License
