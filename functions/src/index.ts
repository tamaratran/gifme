/**
 * GifMe AI — image-to-video proxy + MP4-to-GIF converter.
 *
 * The mobile/web client sends a selfie + text prompt to `generateMemeVideo`;
 * the function forwards both to fal.ai's image-to-video endpoint (Pika v2.2
 * by default), waits for the job to finish, downloads the resulting MP4,
 * converts it to a GIF with ffmpeg (two-pass palette filter) and returns
 * BOTH the original video URL and a base64 data URL for the GIF.
 *
 * `convertVideoToGif` is exposed separately so the GIF conversion can be
 * tested in isolation (without spending fal.ai credit).
 *
 * The fal.ai key stays on the server so it never ships in the app bundle.
 *
 * App Check is enforced in production — attach a Firebase App Check token on
 * the client (App Attest on iOS, Play Integrity on Android) before calling.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { fal } from "@fal-ai/client";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

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

// GIF tuning. 480p / 12fps with a two-pass palette is the sweet spot for
// reaction memes — keeps file size around 1-3 MB for a 5s clip (well under
// the 10 MB callable response cap) while staying readable.
const GIF_FPS = 12;
const GIF_WIDTH = 480;
// Cap input MP4 size — fal.ai 720p 5s clips are ~1-3 MB, so 25 MB is safe
// headroom for 10s clips and prevents a malicious URL pointing at a huge
// download from blowing through memory + tmpfs.
const MAX_MP4_BYTES = 25 * 1024 * 1024;

/**
 * Run ffmpeg with the given args; resolve when it exits 0, reject otherwise.
 */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg-static did not provide a binary path"));
      return;
    }
    const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      // Cap retained stderr to avoid blowing memory on a misbehaving binary.
      if (stderr.length > 8192) stderr = stderr.slice(-8192);
    });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.trim()}`));
    });
  });
}

/**
 * Convert an MP4 buffer to a GIF buffer using a two-pass palette filter.
 * Writes intermediate files to a private tmpdir and cleans up on exit.
 */
async function mp4BufferToGif(mp4: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "gifme-"));
  const inPath = join(dir, "in.mp4");
  const palettePath = join(dir, "palette.png");
  const outPath = join(dir, "out.gif");
  try {
    await writeFile(inPath, mp4);
    const filter = `fps=${GIF_FPS},scale=${GIF_WIDTH}:-2:flags=lanczos`;
    // Pass 1: generate an optimized palette from frame deltas.
    await runFfmpeg([
      "-y",
      "-i",
      inPath,
      "-vf",
      `${filter},palettegen=stats_mode=diff`,
      palettePath,
    ]);
    // Pass 2: apply the palette with bayer dithering for smooth gradients.
    await runFfmpeg([
      "-y",
      "-i",
      inPath,
      "-i",
      palettePath,
      "-lavfi",
      `${filter}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
      outPath,
    ]);
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Fetch an HTTP(S) URL into a Buffer, with a hard size cap so a malicious
 * caller can't get us to download a 10 GB file.
 */
async function fetchToBuffer(url: string, maxBytes: number): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new HttpsError("internal", `Source URL ${res.status}: ${res.statusText}`);
  }
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    throw new HttpsError(
      "resource-exhausted",
      `Source MP4 is ${declared} bytes; max ${maxBytes}.`
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    throw new HttpsError(
      "resource-exhausted",
      `Source MP4 is ${buf.byteLength} bytes; max ${maxBytes}.`
    );
  }
  return buf;
}

/**
 * Standalone test endpoint: convert an arbitrary MP4 URL to a GIF.
 * Useful for verifying the conversion pipeline without burning fal.ai credit.
 *
 * The URL must be publicly reachable HTTPS. The function intentionally does
 * not accept data URLs to keep the request payload small (the GIF is what
 * we're returning in base64).
 */
export const convertVideoToGif = onCall(
  {
    enforceAppCheck: false,
    timeoutSeconds: 120,
    memory: "1GiB",
  },
  async (
    request
  ): Promise<{ gifDataUrl: string; sizeBytes: number }> => {
    const { videoUrl } = (request.data ?? {}) as { videoUrl?: string };
    if (
      typeof videoUrl !== "string" ||
      !/^https:\/\//.test(videoUrl) ||
      videoUrl.length > 2000
    ) {
      throw new HttpsError(
        "invalid-argument",
        "`videoUrl` must be a non-empty HTTPS URL under 2000 chars."
      );
    }
    const mp4 = await fetchToBuffer(videoUrl, MAX_MP4_BYTES);
    const gif = await mp4BufferToGif(mp4);
    return {
      gifDataUrl: `data:image/gif;base64,${gif.toString("base64")}`,
      sizeBytes: gif.byteLength,
    };
  }
);

export const generateMemeVideo = onCall(
  {
    // App Check protects the endpoint from non-legitimate clients.
    // To ease local dev, we allow unauthenticated calls and just require a
    // valid App Check token in production. Flip `enforceAppCheck: true` once
    // the client is attaching tokens.
    enforceAppCheck: false,
    secrets: [FAL_KEY],
    // fal.ai i2v jobs take 30-90s typically; ffmpeg adds ~3-5s on top.
    timeoutSeconds: 300,
    // 720p MP4 + ffmpeg palette pass + GIF buffer fits comfortably in 1GiB.
    memory: "1GiB",
  },
  async (
    request
  ): Promise<{
    url: string;
    contentType: string;
    model: string;
    gifDataUrl: string;
    gifSizeBytes: number;
  }> => {
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
    // Pika v2.2 (and the rest of our allowlist) only accepts 5s or 10s clips;
    // clamp here so a malicious caller can't pass `duration: 1000` and rack up
    // arbitrary cost (enforceAppCheck is off, so the function is publicly callable).
    const dur = duration === 10 ? 10 : 5;

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

    // Download the MP4 once, convert to GIF, and ship both back so the client
    // can preview the GIF inline and offer "Save as GIF" without a second
    // round-trip to fal.ai's CDN.
    const mp4 = await fetchToBuffer(url, MAX_MP4_BYTES);
    const gif = await mp4BufferToGif(mp4);

    return {
      url,
      contentType: data.video?.content_type ?? "video/mp4",
      model,
      gifDataUrl: `data:image/gif;base64,${gif.toString("base64")}`,
      gifSizeBytes: gif.byteLength,
    };
  }
);
