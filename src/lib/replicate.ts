/**
 * Thin Replicate API client. We hit the HTTP API directly so we don't pull
 * in the `replicate` npm package (it's Node-centric and not great in RN).
 *
 * Docs: https://replicate.com/docs/reference/http
 */

const API_BASE = "https://api.replicate.com/v1";

/**
 * Face-swap model. Takes an `input_image` (the target frame) and a `swap_image`
 * (the source selfie with the face to inject) and returns a URL of the swapped
 * image. We pin by version so behavior is reproducible.
 *
 * cdingram/face-swap — https://replicate.com/cdingram/face-swap
 */
export const FACE_SWAP_VERSION =
  "d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111";

export type Prediction = {
  id: string;
  status:
    | "starting"
    | "processing"
    | "succeeded"
    | "failed"
    | "canceled";
  output?: string | string[];
  error?: string | null;
  urls: { get: string; cancel: string };
};

function token(): string {
  const t =
    process.env.EXPO_PUBLIC_REPLICATE_API_TOKEN ??
    (globalThis as unknown as { REPLICATE_API_TOKEN?: string })
      .REPLICATE_API_TOKEN;
  if (!t) {
    throw new Error(
      "Missing EXPO_PUBLIC_REPLICATE_API_TOKEN. Set it in .env and restart Expo."
    );
  }
  return t;
}

async function http<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token()}`,
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const body = init?.json !== undefined ? JSON.stringify(init.json) : init?.body;
  const res = await fetch(
    path.startsWith("http") ? path : `${API_BASE}${path}`,
    { ...init, headers, body: body as BodyInit | undefined }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Replicate ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

/** Create a prediction and return the initial object. */
export async function createPrediction(input: {
  version: string;
  input: Record<string, unknown>;
}): Promise<Prediction> {
  return http<Prediction>("/predictions", { method: "POST", json: input });
}

/** Fetch current state of a prediction. */
export async function getPrediction(url: string): Promise<Prediction> {
  return http<Prediction>(url);
}

/**
 * Create + poll a prediction to completion. Polls every 1s, up to `timeoutMs`.
 */
export async function runPrediction(
  input: { version: string; input: Record<string, unknown> },
  opts: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const intervalMs = opts.intervalMs ?? 1_000;
  const start = Date.now();

  let pred = await createPrediction(input);
  while (pred.status === "starting" || pred.status === "processing") {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Prediction ${pred.id} timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    pred = await getPrediction(pred.urls.get);
  }

  if (pred.status !== "succeeded") {
    throw new Error(
      `Prediction ${pred.id} ${pred.status}: ${pred.error ?? "unknown error"}`
    );
  }

  const out = pred.output;
  const url = Array.isArray(out) ? out[0] : out;
  if (typeof url !== "string") {
    throw new Error(`Prediction ${pred.id} returned no output URL`);
  }
  return url;
}

/**
 * Run face-swap on a single frame. `inputImage` is the meme frame (the target
 * we're replacing the face of); `swapImage` is the user's selfie (the source
 * face being injected). Both are data URLs (base64) or public URLs.
 */
export async function faceSwap(
  inputImage: string,
  swapImage: string
): Promise<string> {
  return runPrediction({
    version: FACE_SWAP_VERSION,
    input: { input_image: inputImage, swap_image: swapImage },
  });
}
