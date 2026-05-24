import type { Frame } from '../types/frame';

export interface FrameRenderResult {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  imageBitmaps: ImageBitmap[];
  width: number;
  height: number;
}

export async function createFrameRenderContext(frames: Frame[]): Promise<FrameRenderResult> {
  const imageBitmaps = await Promise.all(frames.map(f => createImageBitmap(f.file)));
  const width = imageBitmaps[0].width;
  const height = imageBitmaps[0].height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Could not get canvas context");

  return { canvas, ctx, imageBitmaps, width, height };
}

export function renderFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  frame: Frame,
  width: number,
  height: number
) {
  const scale = frame.scale || 1;
  const rotation = frame.rotation || 0;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  const cx = (width / 2) + frame.offsetX;
  const cy = (height / 2) + frame.offsetY;
  ctx.translate(cx, cy);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
}
