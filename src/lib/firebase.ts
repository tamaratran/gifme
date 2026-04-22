/**
 * Firebase client for GifMe AI. We only use Cloud Functions (HTTPS callable)
 * right now — no auth, no Firestore, no Storage. The config values are safe
 * to ship in the bundle (they identify the project, they're not secrets).
 *
 * See: https://firebase.google.com/docs/web/learn-more#config-object
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFunctions,
  httpsCallable,
  type Functions,
} from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
};

let app: FirebaseApp | null = null;
let functions: Functions | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  if (!firebaseConfig.projectId) {
    throw new Error(
      "Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID. Set Firebase env vars in .env and restart Expo."
    );
  }
  app = getApps()[0] ?? initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseFunctions(): Functions {
  if (functions) return functions;
  functions = getFunctions(getFirebaseApp(), "us-central1");
  return functions;
}

/** Typed wrapper around the `faceSwap` HTTPS callable. */
export async function callFaceSwap(input: {
  inputImage: string;
  swapImage: string;
}): Promise<string> {
  const fn = httpsCallable<
    { inputImage: string; swapImage: string },
    { url: string }
  >(getFirebaseFunctions(), "faceSwap");
  const res = await fn(input);
  return res.data.url;
}
