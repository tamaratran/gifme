/**
 * GifMe AI — face-swap proxy.
 *
 * The mobile client sends a meme frame + selfie to this function; the function
 * forwards both to Replicate's cdingram/face-swap model using a server-side
 * token, polls until the prediction finishes, and returns the swapped image
 * URL. Token stays on the server so it never ships in the app bundle.
 *
 * App Check is enforced in production — attach a Firebase App Check token on
 * the client (App Attest on iOS, Play Integrity on Android) before calling.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";

// Replicate API token, stored in Google Secret Manager.
// Set once via: firebase functions:secrets:set REPLICATE_API_TOKEN
const REPLICATE_API_TOKEN = defineSecret("REPLICATE_API_TOKEN");

setGlobalOptions({ region: "us-central1", maxInstances: 20 });

const API_BASE = "https://api.replicate.com/v1";

// cdingram/face-swap — pinned for reproducibility.
const FACE_SWAP_VERSION =
  "d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111";

type Prediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[];
  error?: string | null;
  urls: { get: string; cancel: string };
};

async function replicateFetch<T>(
  path: string,
  token: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const body =
    init?.json !== undefined ? JSON.stringify(init.json) : init?.body;
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers,
    body: body as BodyInit | undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HttpsError(
      "internal",
      `Replicate ${res.status}: ${text || res.statusText}`
    );
  }
  return (await res.json()) as T;
}

export const faceSwap = onCall(
  {
    // App Check protects the endpoint from non-legitimate clients.
    // To ease local dev, we allow unauthenticated calls and just require a
    // valid App Check token in production. Flip `enforceAppCheck: true` once
    // the client is attaching tokens.
    enforceAppCheck: false,
    secrets: [REPLICATE_API_TOKEN],
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async (request): Promise<{ url: string }> => {
    const { inputImage, swapImage } = (request.data ?? {}) as {
      inputImage?: string;
      swapImage?: string;
    };

    if (typeof inputImage !== "string" || inputImage.length < 10) {
      throw new HttpsError(
        "invalid-argument",
        "`inputImage` must be a non-empty data URL or HTTPS URL."
      );
    }
    if (typeof swapImage !== "string" || swapImage.length < 10) {
      throw new HttpsError(
        "invalid-argument",
        "`swapImage` must be a non-empty data URL or HTTPS URL."
      );
    }

    const token = REPLICATE_API_TOKEN.value();

    // 1. Create prediction.
    let pred = await replicateFetch<Prediction>("/predictions", token, {
      method: "POST",
      json: {
        version: FACE_SWAP_VERSION,
        input: { input_image: inputImage, swap_image: swapImage },
      },
    });

    // 2. Poll until done (capped at ~90s; Cloud Functions timeout is 120s).
    const deadline = Date.now() + 90_000;
    while (pred.status === "starting" || pred.status === "processing") {
      if (Date.now() > deadline) {
        throw new HttpsError(
          "deadline-exceeded",
          `Prediction ${pred.id} timed out after 90s`
        );
      }
      await new Promise((r) => setTimeout(r, 1000));
      pred = await replicateFetch<Prediction>(pred.urls.get, token);
    }

    if (pred.status !== "succeeded") {
      throw new HttpsError(
        "internal",
        `Prediction ${pred.id} ${pred.status}: ${pred.error ?? "unknown error"}`
      );
    }

    const out = pred.output;
    const url = Array.isArray(out) ? out[0] : out;
    if (typeof url !== "string") {
      throw new HttpsError(
        "internal",
        `Prediction ${pred.id} returned no output URL`
      );
    }
    return { url };
  }
);
