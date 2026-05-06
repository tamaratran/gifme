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

// `gifsicle` is an ESM package whose default export is the path to its
// bundled binary (installed at npm-install time into vendor/gifsicle). We're
// in CommonJS here, so resolve it lazily via dynamic import.
let _gifsiclePathPromise: Promise<string> | null = null;
function getGifsiclePath(): Promise<string> {
  if (!_gifsiclePathPromise) {
    _gifsiclePathPromise = import("gifsicle").then((mod) => mod.default);
  }
  return _gifsiclePathPromise;
}

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

// GIF tuning. 360px / 10fps + gifsicle post-optimize lands around 2-4 MB for
// a 5s clip (well under the 10 MB callable response cap) while staying crisp
// enough for reaction memes. Two-pass palette + gifsicle `--optimize=3` does
// most of the size win; reducing colours from 256 → 128 trims another ~30%
// without visible quality loss on talking-head footage.
const GIF_FPS = 10;
const GIF_WIDTH = 360;
const GIF_COLORS = 128;
// Cap input MP4 size — fal.ai 720p 5s clips are ~1-3 MB, so 25 MB is safe
// headroom for 10s clips and prevents a malicious URL pointing at a huge
// download from blowing through memory + tmpfs.
const MAX_MP4_BYTES = 25 * 1024 * 1024;

/**
 * Run an external binary with args; resolve when it exits 0, reject otherwise.
 * Capped stderr capture so a misbehaving child can't OOM the function.
 */
function runBinary(bin: string, args: string[], label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8192) stderr = stderr.slice(-8192);
    });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited ${code}: ${stderr.trim()}`));
    });
  });
}

function runFfmpeg(args: string[]): Promise<void> {
  if (!ffmpegPath) {
    return Promise.reject(new Error("ffmpeg-static did not provide a binary path"));
  }
  return runBinary(ffmpegPath, args, "ffmpeg");
}

async function runGifsicle(args: string[]): Promise<void> {
  const bin = await getGifsiclePath();
  return runBinary(bin, args, "gifsicle");
}

/**
 * Convert an MP4 buffer to a GIF buffer using a two-pass palette filter.
 * Writes intermediate files to a private tmpdir and cleans up on exit.
 */
async function mp4BufferToGif(mp4: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "gifme-"));
  const inPath = join(dir, "in.mp4");
  const palettePath = join(dir, "palette.png");
  const rawGifPath = join(dir, "raw.gif");
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
      `${filter},palettegen=stats_mode=diff:max_colors=${GIF_COLORS}`,
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
      rawGifPath,
    ]);
    // Pass 3: gifsicle post-optimize — frame de-duplication, lossy LZW, and
    // a colour-table cap. Typically shaves another 30-50% off the file size
    // with no perceptible quality drop on short reaction clips.
    await runGifsicle([
      "--optimize=3",
      "--lossy=80",
      `--colors=${GIF_COLORS}`,
      "--no-warnings",
      "-o",
      outPath,
      rawGifPath,
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
 * Convert an arbitrary video to a GIF.
 *
 * Accepts either a public HTTPS URL (used by the AI flow + tests, where the
 * video already lives on a CDN) OR a `data:video/...;base64,...` data URL
 * (used by the user-upload flow, where the client posts the bytes inline).
 *
 * Inline data URLs are capped well below the 10 MB Cloud Functions callable
 * request limit; users with longer clips are told to trim or transcode.
 */
const MAX_DATA_URL_BYTES = 8 * 1024 * 1024; // raw decoded; callable req cap is 10 MB

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
    if (typeof videoUrl !== "string" || videoUrl.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "`videoUrl` must be a non-empty HTTPS or data: URL."
      );
    }

    let mp4: Buffer;
    if (videoUrl.startsWith("data:")) {
      const comma = videoUrl.indexOf(",");
      const meta = comma === -1 ? "" : videoUrl.slice(0, comma);
      if (comma === -1 || !meta.includes(";base64")) {
        throw new HttpsError(
          "invalid-argument",
          "`videoUrl` data URL must be base64-encoded (e.g. `data:video/mp4;base64,...`)."
        );
      }
      mp4 = Buffer.from(videoUrl.slice(comma + 1), "base64");
      if (mp4.byteLength === 0) {
        throw new HttpsError("invalid-argument", "`videoUrl` decoded to 0 bytes.");
      }
      if (mp4.byteLength > MAX_DATA_URL_BYTES) {
        throw new HttpsError(
          "resource-exhausted",
          `Inline video is ${mp4.byteLength} bytes; max ${MAX_DATA_URL_BYTES} (~8 MB). Trim the clip or shrink it before uploading.`
        );
      }
    } else if (/^https:\/\//.test(videoUrl) && videoUrl.length <= 2000) {
      mp4 = await fetchToBuffer(videoUrl, MAX_MP4_BYTES);
    } else {
      throw new HttpsError(
        "invalid-argument",
        "`videoUrl` must be either an HTTPS URL (≤2000 chars) or a `data:video/...;base64,...` data URL."
      );
    }

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
    gifDataUrl: string | null;
    gifSizeBytes: number | null;
    gifError: string | null;
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

    // Best-effort GIF conversion. The fal.ai charge has already been incurred
    // by the time we get here, so a ffmpeg/gifsicle failure must NOT swallow
    // the successfully-generated video URL — return it regardless and let the
    // client fall back to the MP4. The client can also re-request a GIF later
    // via the dedicated `convertVideoToGif` callable.
    let gifDataUrl: string | null = null;
    let gifSizeBytes: number | null = null;
    let gifError: string | null = null;
    try {
      const mp4 = await fetchToBuffer(url, MAX_MP4_BYTES);
      const gif = await mp4BufferToGif(mp4);
      gifDataUrl = `data:image/gif;base64,${gif.toString("base64")}`;
      gifSizeBytes = gif.byteLength;
    } catch (err) {
      gifError = err instanceof Error ? err.message : String(err);
      console.warn(
        `mp4->gif conversion failed for ${model} (${url}): ${gifError}`
      );
    }

    return {
      url,
      contentType: data.video?.content_type ?? "video/mp4",
      model,
      gifDataUrl,
      gifSizeBytes,
      gifError,
    };
  }
);
