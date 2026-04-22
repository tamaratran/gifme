declare module "omggif" {
  export type FrameInfo = {
    x: number;
    y: number;
    width: number;
    height: number;
    has_local_palette: boolean;
    palette_offset: number;
    palette_size: number;
    data_offset: number;
    data_length: number;
    transparent_index: number | null;
    interlaced: boolean;
    delay: number;
    disposal: number;
  };

  export class GifReader {
    constructor(buf: Uint8Array);
    width: number;
    height: number;
    loopCount(): number;
    numFrames(): number;
    frameInfo(frameNum: number): FrameInfo;
    decodeAndBlitFrameRGBA(frameNum: number, pixels: Uint8Array): void;
    decodeAndBlitFrameBGRA(frameNum: number, pixels: Uint8Array): void;
  }

  export class GifWriter {
    constructor(
      buf: Uint8Array,
      width: number,
      height: number,
      gopts?: { loop?: number; palette?: number[] }
    );
    addFrame(
      x: number,
      y: number,
      width: number,
      height: number,
      indexedPixels: Uint8Array,
      opts?: {
        palette?: number[];
        delay?: number;
        disposal?: number;
        transparent?: number;
      }
    ): number;
    end(): number;
    getOutputBuffer(): Uint8Array;
  }
}
