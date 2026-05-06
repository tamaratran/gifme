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
  // fal.ai i2v jobs typically take 30-90s; bump the client timeout to match
  // the server-side `timeoutSeconds: 300` in functions/src/index.ts so the
  // callable doesn't abort before the function returns (otherwise we get
  // billed for the clip but never download it).
  functions = getFunctions(getFirebaseApp(), "us-central1");
  return functions;
}

/** Typed wrapper around the `generateMemeVideo` HTTPS callable. */
export async function callGenerateMemeVideo(input: {
  selfieDataUrl: string;
  prompt: string;
  duration?: number;
  model?: string;
}): Promise<{ url: string; contentType: string; model: string }> {
  const fn = httpsCallable<
    {
      selfieDataUrl: string;
      prompt: string;
      duration?: number;
      model?: string;
    },
    { url: string; contentType: string; model: string }
  >(getFirebaseFunctions(), "generateMemeVideo", {
    timeout: 300_000,
  });
  const res = await fn(input);
  return res.data;
}

/**
 * Typed wrapper around the `convertVideoToGif` HTTPS callable. `videoUrl`
 * may be either a public HTTPS URL or a `data:video/...;base64,...` data URL.
 */
export async function callConvertVideoToGif(input: {
  videoUrl: string;
}): Promise<{ gifDataUrl: string; sizeBytes: number }> {
  const fn = httpsCallable<
    { videoUrl: string },
    { gifDataUrl: string; sizeBytes: number }
  >(getFirebaseFunctions(), "convertVideoToGif", {
    // ffmpeg + gifsicle on a 5-10s clip take ~13-30s wall time; give the
    // client plenty of headroom over the server-side timeoutSeconds (120s).
    timeout: 180_000,
  });
  const res = await fn(input);
  return res.data;
}
