import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "./config";
import { AuthUser } from "@/types/user";

// Initialize Google Sign-In
export function configureGoogleSignIn() {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  if (!webClientId) {
    console.warn("Google Sign-In: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set");
    return;
  }

  GoogleSignin.configure({
    webClientId,
    offlineAccess: true,
  });
}

export async function signInWithGoogle(): Promise<{
  firebaseUser: any;
  authUser: AuthUser;
}> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error("Google Sign-In is not configured. Please set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.");
  }

  try {
    // Check if Play Services are available
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Sign in with Google
    const response = await GoogleSignin.signIn();

    if (!response.data?.idToken) {
      throw new Error("No ID token received from Google Sign-In");
    }

    // Create Firebase credential
    const googleCredential = GoogleAuthProvider.credential(response.data.idToken);

    // Sign in to Firebase
    const firebaseUserCredential = await signInWithCredential(auth, googleCredential);
    const firebaseUser = firebaseUserCredential.user;

    // Create AuthUser object
    const authUser: AuthUser = {
      id: firebaseUser.uid,
      email: firebaseUser.email,
      fullName: firebaseUser.displayName,
      googleUserId: response.data.user.id,
      authProvider: "google",
      plan: "standard",
    };

    return { firebaseUser, authUser };
  } catch (error) {
    if (isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw { code: "ERR_REQUEST_CANCELED", message: "Sign in cancelled" };
        case statusCodes.IN_PROGRESS:
          throw { code: "ERR_IN_PROGRESS", message: "Sign in already in progress" };
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw {
            code: "ERR_PLAY_SERVICES",
            message: "Google Play Services not available",
          };
        default:
          throw error;
      }
    }
    throw error;
  }
}

export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.warn("Google signOut error:", error);
  }
}

export async function isGoogleSignedIn(): Promise<boolean> {
  try {
    const user = await GoogleSignin.getCurrentUser();
    return user !== null;
  } catch {
    return false;
  }
}
