import type { Persistence, ReactNativeAsyncStorage } from "firebase/auth";

// firebase/auth exports getReactNativePersistence only from its React Native build, but the
// package's "types" export condition comes before "react-native", so TypeScript resolves the
// web typings and reports it missing. Metro loads the React Native build at runtime.
declare module "firebase/auth" {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
