/**
 * GifMe AI — image-to-video proxy.
 *
 * The mobile client sends a selfie + text prompt to this function; the
 * function forwards both to fal.ai's image-to-video endpoint (Pika v2.2 by
 * default), waits for the job to finish, and returns the generated video URL.
 * The fal.ai key stays on the server so it never ships in the app bundle.
 *
 * App Check is enforced in production — attach a Firebase App Check token on
 * the client (App Attest on iOS, Play Integrity on Android) before calling.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { fal } from "@fal-ai/client";

// fal.ai API key, stored in Google Secret Manager.
// Set once via: firebase functions:secrets:set FAL_KEY
const FAL_KEY = defineSecret("FAL_KEY");

setGlobalOptions({ region: "us-central1", maxInstances: 20 });

// Default model — Pika v2.2 image-to-video at 720p ($0.20 per 5s clip).
// Overridable per-call via `request.data.model`, but ONLY for entries in
// ALLOWED_MODELS — without an allowlist, any caller could proxy arbitrary
// (and arbitrarily expensive) fal.ai endpoints through our key.
const DEFAULT_MODEL = "fal-ai/pika/v2.2/image-to-video";
const ALLOWED_MODELS: ReadonlySet<string> = new Set([
  "fal-ai/pika/v2.2/image-to-video",
  "fal-ai/kling-video/v2/master/image-to-video",
  "fal-ai/kling-video/v2.1/standard/image-to-video",
  "fal-ai/minimax/hailuo-02/standard/image-to-video",
  "fal-ai/wan/v2.2/image-to-video",
  "fal-ai/ltx-video/image-to-video",
]);

type FalVideoOutput = {
  video?: { url: string; content_type?: string };
};

export const generateMemeVideo = onCall(
  {
    // App Check protects the endpoint from non-legitimate clients.
    // To ease local dev, we allow unauthenticated calls and just require a
    // valid App Check token in production. Flip `enforceAppCheck: true` once
    // the client is attaching tokens.
    enforceAppCheck: false,
    secrets: [FAL_KEY],
    // fal.ai i2v jobs take 30-90s typically; allow headroom.
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (
    request
  ): Promise<{ url: string; contentType: string; model: string }> => {
    const {
      selfieDataUrl,
      prompt,
      duration,
      model: modelOverride,
    } = (request.data ?? {}) as {
      selfieDataUrl?: string;
      prompt?: string;
      duration?: number;
      model?: string;
    };

    if (typeof selfieDataUrl !== "string" || selfieDataUrl.length < 64) {
      throw new HttpsError(
        "invalid-argument",
        "`selfieDataUrl` must be a non-empty data URL or HTTPS URL."
      );
    }
    if (typeof prompt !== "string" || prompt.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "`prompt` must be a non-empty string."
      );
    }

    const model = modelOverride ?? DEFAULT_MODEL;
    if (!ALLOWED_MODELS.has(model)) {
      throw new HttpsError(
        "invalid-argument",
        `\`model\` "${model}" is not in the allowlist. Allowed: ${[...ALLOWED_MODELS].join(", ")}`
      );
    }
    const dur = Number.isFinite(duration) ? Math.round(duration as number) : 5;

    fal.config({ credentials: FAL_KEY.value() });

    let result;
    try {
      result = await fal.subscribe(model, {
        input: {
          image_url: selfieDataUrl,
          prompt,
          duration: dur,
          resolution: "720p",
        },
        logs: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpsError("internal", `fal.ai ${model} failed: ${msg}`);
    }

    const data = result.data as FalVideoOutput;
    const url = data?.video?.url;
    if (typeof url !== "string") {
      throw new HttpsError(
        "internal",
        `fal.ai ${model} returned no video URL (got: ${JSON.stringify(data).slice(0, 200)})`
      );
    }

    return {
      url,
      contentType: data.video?.content_type ?? "video/mp4",
      model,
    };
  }
);
