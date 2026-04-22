/**
 * Pure-JS GIF decode + encode for React Native.
 *
 * - Decode: `omggif` parses the GIF and blits each frame into an RGBA buffer.
 * - Encode: `gifenc` quantizes RGBA frames into a palette and writes a new GIF.
 *
 * We expose `decodeGif` and `encodeGif` plus the shape we pass between them
 * (`RGBAFrame`). Both operate on pure `Uint8Array` buffers — no DOM, no
 * canvas, no native modules.
 */
import { GifReader } from "omggif";
import { GIFEncoder, quantize, applyPalette } from "gifenc";

export type RGBAFrame = {
  width: number;
  height: number;
  /** RGBA Uint8Array of length width*height*4. */
  rgba: Uint8Array;
  /** Frame duration in centiseconds (1cs = 10ms), matching GIF spec. */
  delayCs: number;
};

export function decodeGif(bytes: Uint8Array): RGBAFrame[] {
  const reader = new GifReader(bytes);
  const { width, height } = reader;
  const frames: RGBAFrame[] = [];
  for (let i = 0; i < reader.numFrames(); i++) {
    const rgba = new Uint8Array(width * height * 4);
    reader.decodeAndBlitFrameRGBA(i, rgba);
    const info = reader.frameInfo(i);
    frames.push({
      width,
      height,
      rgba,
      delayCs: info.delay > 0 ? info.delay : 10,
    });
  }
  return frames;
}

/** Encode a stack of RGBA frames into GIF bytes. All frames must share dims. */
export function encodeGif(frames: RGBAFrame[]): Uint8Array {
  if (frames.length === 0) throw new Error("encodeGif: no frames");
  const first = frames[0]!;
  const { width, height } = first;

  const enc = GIFEncoder();
  for (const f of frames) {
    if (f.width !== width || f.height !== height) {
      throw new Error("encodeGif: frame dimensions must match");
    }
    const palette = quantize(f.rgba, 256, { format: "rgba4444" });
    const index = applyPalette(f.rgba, palette, "rgba4444");
    enc.writeFrame(index, width, height, {
      palette,
      delay: f.delayCs * 10, // gifenc expects milliseconds
    });
  }
  enc.finish();
  return enc.bytes();
}
