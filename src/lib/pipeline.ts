/**
 * Face-swap pipeline: given a meme GIF URL and a selfie URI, produce a new
 * GIF with the user's face swapped onto every frame.
 *
 * Steps:
 *   1. Fetch the meme GIF as bytes.
 *   2. Decode into RGBA frames (omggif).
 *   3. For each frame, JPEG-encode → upload to Replicate face-swap → download
 *      the swapped frame → JPEG-decode back to RGBA.
 *   4. Re-encode all swapped frames into a single GIF (gifenc).
 *   5. Write to the cache directory and return the file URI.
 *
 * Frames run in a bounded-concurrency pool so we don't blow past Replicate's
 * rate limits.
 */
import * as FileSystem from "expo-file-system/legacy";
import jpeg from "jpeg-js";

import { decodeGif, encodeGif, type RGBAFrame } from "./gif";
import { faceSwap } from "./replicate";
import { fileToDataUrl } from "./base64";

export type PipelineProgress = {
  phase: "fetch" | "decode" | "swap" | "encode" | "save";
  done: number;
  total: number;
};

type Opts = {
  /** Max concurrent face-swap calls. Replicate allows plenty; 4 is polite. */
  concurrency?: number;
  onProgress?: (p: PipelineProgress) => void;
};

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

function rgbaToJpegDataUrl(frame: RGBAFrame, quality = 80): string {
  const encoded = jpeg.encode(
    { data: frame.rgba, width: frame.width, height: frame.height },
    quality
  );
  // jpeg-js returns a Node-ish Buffer-like with a .data Uint8Array.
  const bytes = encoded.data;
  // Base64 encode manually — we avoid `Buffer` to keep this RN-safe.
  return `data:image/jpeg;base64,${uint8ToBase64(bytes)}`;
}

async function dataUrlToRgba(
  url: string,
  width: number,
  height: number
): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const decoded = jpeg.decode(buf, { useTArray: true });
  if (decoded.width === width && decoded.height === height) {
    return new Uint8Array(decoded.data);
  }
  // Dimensions changed — resize with nearest-neighbor so the frame stream
  // stays uniform. (Replicate face-swap rarely changes dims, but guard.)
  return resizeRGBA(decoded.data, decoded.width, decoded.height, width, height);
}

function resizeRGBA(
  src: Uint8Array | Buffer,
  sw: number,
  sh: number,
  dw: number,
  dh: number
): Uint8Array {
  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / dw));
      const si = (sy * sw + sx) * 4;
      const di = (y * dw + x) * 4;
      out[di] = src[si]!;
      out[di + 1] = src[si + 1]!;
      out[di + 2] = src[si + 2]!;
      out[di + 3] = src[si + 3]!;
    }
  }
  return out;
}

/** Pure-JS Uint8Array → base64. */
function uint8ToBase64(bytes: Uint8Array): string {
  // Build the binary string in chunks to avoid call-stack overflow for
  // large arrays (String.fromCharCode.apply can blow up on ~100k+ args).
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  // globalThis.btoa is available in Hermes / React Native 0.70+.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = (globalThis as any).btoa as undefined | ((s: string) => string);
  if (b) return b(binary);
  throw new Error("btoa unavailable on this runtime");
}

async function pMap<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let i = 0;
  async function run() {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx]!, idx);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    run
  );
  await Promise.all(workers);
  return results;
}

/**
 * Swap every frame of `memeGifUrl` with the face from `selfieUri`.
 * Returns a local file URI pointing at the rendered GIF.
 */
export async function swapFacesInGif(
  memeGifUrl: string,
  selfieUri: string,
  outputFilename: string,
  opts: Opts = {}
): Promise<string> {
  const concurrency = opts.concurrency ?? 4;
  const progress = opts.onProgress ?? (() => {});

  progress({ phase: "fetch", done: 0, total: 1 });
  const memeBytes = await fetchBytes(memeGifUrl);
  progress({ phase: "fetch", done: 1, total: 1 });

  progress({ phase: "decode", done: 0, total: 1 });
  const frames = decodeGif(memeBytes);
  progress({ phase: "decode", done: 1, total: 1 });

  const selfieDataUrl = await fileToDataUrl(selfieUri, "image/jpeg");

  let swapped = 0;
  progress({ phase: "swap", done: 0, total: frames.length });

  const swappedFrames = await pMap(
    frames,
    async (frame) => {
      const frameJpeg = rgbaToJpegDataUrl(frame, 80);
      const resultUrl = await faceSwap(frameJpeg, selfieDataUrl);
      const newRgba = await dataUrlToRgba(resultUrl, frame.width, frame.height);
      swapped++;
      progress({ phase: "swap", done: swapped, total: frames.length });
      return { ...frame, rgba: newRgba } satisfies RGBAFrame;
    },
    concurrency
  );

  progress({ phase: "encode", done: 0, total: 1 });
  const out = encodeGif(swappedFrames);
  progress({ phase: "encode", done: 1, total: 1 });

  progress({ phase: "save", done: 0, total: 1 });
  const dest = `${FileSystem.cacheDirectory}${outputFilename}`;
  await FileSystem.writeAsStringAsync(dest, uint8ToBase64(out), {
    encoding: FileSystem.EncodingType.Base64,
  });
  progress({ phase: "save", done: 1, total: 1 });

  return dest;
}
