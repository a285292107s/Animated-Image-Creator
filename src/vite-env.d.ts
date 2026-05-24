/// <reference types="vite/client" />

declare module 'upng-js' {
  interface UPNGFrame {
    delay: number;
  }

  interface UPNGDecoded {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: UPNGFrame[];
    tabs: Record<string, Uint8Array>;
  }

  export interface UPNG {
    encode(
      imgs: ArrayBuffer[],
      w: number,
      h: number,
      cnum: number,
      dels?: number[]
    ): ArrayBuffer;
    decode(buffer: ArrayBuffer): UPNGDecoded;
    toRGBA8(out: UPNGDecoded): ArrayBuffer[];
  }

  const upng: UPNG;
  export default upng;
}