/**
 * Image-to-video pipeline: given a selfie URI and a meme prompt, generate a
 * short reaction video via fal.ai (Pika v2.2 by default) and write it to the
 * cache directory ready to be saved to Photos.
 *
 * Steps:
 *   1. Encode the selfie as a data URL (JPEG, base64) so the Cloud Function
 *      can forward it to fal.ai.
 *   2. Call the `generateMemeVideo` callable, which proxies fal.ai with the
 *      server-side API key.
 *   3. Download the returned MP4 to local cache.
 *   4. Return the local file URI.
 *
 * No frame loops, no heavy in-app GIF encoding — fal.ai does the generation
 * and the client just transports bytes.
 */
import { fileToDataUrl, downloadToCache } from "./base64";
import { callGenerateMemeVideo } from "./firebase";

export type PipelineProgress = {
  phase: "encode" | "generate" | "download" | "save";
  done: number;
  total: number;
};

type Opts = {
  onProgress?: (p: PipelineProgress) => void;
  /** Override the fal.ai model id (defaults to Pika v2.2 server-side). */
  model?: string;
};

/**
 * Generate a meme reaction video from a selfie + prompt and stash the MP4 in
 * cache. Returns the local file URI.
 */
export async function generateMemeVideo(
  selfieUri: string,
  prompt: string,
  duration: number,
  outputFilename: string,
  opts: Opts = {}
): Promise<{ uri: string; remoteUrl: string; contentType: string }> {
  const progress = opts.onProgress ?? (() => {});

  progress({ phase: "encode", done: 0, total: 1 });
  const selfieDataUrl = await fileToDataUrl(selfieUri, "image/jpeg");
  progress({ phase: "encode", done: 1, total: 1 });

  progress({ phase: "generate", done: 0, total: 1 });
  const { url, contentType } = await callGenerateMemeVideo({
    selfieDataUrl,
    prompt,
    duration,
    model: opts.model,
  });
  progress({ phase: "generate", done: 1, total: 1 });

  progress({ phase: "download", done: 0, total: 1 });
  const localUri = await downloadToCache(url, outputFilename);
  progress({ phase: "download", done: 1, total: 1 });

  return { uri: localUri, remoteUrl: url, contentType };
}
