declare module "gifenc" {
  export type Palette = number[][];
  export type QuantizeFormat = "rgb444" | "rgb565" | "rgba4444";

  export type WriteFrameOpts = {
    palette?: Palette;
    delay?: number;
    transparent?: boolean;
    transparentIndex?: number;
    dispose?: number;
    repeat?: number;
    first?: boolean;
  };

  export type Encoder = {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: WriteFrameOpts
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
    readonly buffer: ArrayBuffer;
  };

  export function GIFEncoder(opts?: { initialCapacity?: number }): Encoder;
  export function quantize(
    rgba: Uint8Array,
    maxColors: number,
    opts?: { format?: QuantizeFormat; oneBitAlpha?: boolean | number }
  ): Palette;
  export function applyPalette(
    rgba: Uint8Array,
    palette: Palette,
    format?: QuantizeFormat
  ): Uint8Array;
}
