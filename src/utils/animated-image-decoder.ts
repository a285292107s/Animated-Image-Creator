import type { Frame } from '../types/frame';

interface ImageDecoderInstance {
  readonly complete: boolean;
  readonly completed: Promise<void>;
  readonly tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } };
  decode(options?: { frameIndex?: number }): Promise<{ image: VideoFrame }>;
  close(): void;
}

declare const ImageDecoder: {
  new(init: { data: ArrayBuffer; type: string }): ImageDecoderInstance;
  isTypeSupported(type: string): boolean;
};

const DECODER_TYPES: Record<string, string> = {
  'image/gif': 'image/gif',
  'image/avif': 'image/avif',
  'image/webp': 'image/webp',
};

export function isAnimatedImageFormatSupported(): boolean {
  try {
    return typeof ImageDecoder !== 'undefined' && typeof ImageDecoder.isTypeSupported === 'function';
  } catch {
    return false;
  }
}

export function isImageMimeTypeSupported(mimeType: string): boolean {
  if (!isAnimatedImageFormatSupported()) return false;
  try {
    return ImageDecoder.isTypeSupported(mimeType);
  } catch {
    return false;
  }
}

export async function isAnimatedImage(file: File): Promise<boolean> {
  const type = DECODER_TYPES[file.type];
  if (!type || !isImageMimeTypeSupported(type)) return false;

  const buffer = await file.arrayBuffer();
  const decoder = new ImageDecoder({ data: buffer, type });
  await decoder.tracks.ready;
  const frameCount = decoder.tracks.selectedTrack.frameCount;
  decoder.close();
  return frameCount > 1;
}

export async function decodeAnimatedImage(file: File): Promise<Frame[]> {
  const type = DECODER_TYPES[file.type];
  const buffer = await file.arrayBuffer();
  const decoder = new ImageDecoder({ data: buffer, type });
  await decoder.tracks.ready;

  const frameCount = decoder.tracks.selectedTrack.frameCount;
  const frames: Frame[] = [];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  for (let i = 0; i < frameCount; i++) {
    const result = await decoder.decode({ frameIndex: i });
    const videoFrame = result.image;

    const w = videoFrame.displayWidth;
    const h = videoFrame.displayHeight;

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.drawImage(videoFrame, 0, 0);

    const rawDuration = (videoFrame as unknown as { duration?: number }).duration;
    const delayMs = Math.max(10, Math.round((rawDuration ?? 100_000) / 1000));
    videoFrame.close();

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error(`导出第 ${i} 帧失败`);

    const frameFile = new File([blob], `frame_${i}.png`, { type: 'image/png' });

    frames.push({
      id: Math.random().toString(36).slice(2, 11),
      file: frameFile,
      previewUrl: URL.createObjectURL(blob),
      delay: delayMs,
      width: w,
      height: h,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
      fileSize: blob.size,
      fileType: file.type.split('/')[1].toUpperCase()
    });
  }

  decoder.close();
  return frames;
}
