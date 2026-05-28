import type { Frame } from '../types/frame';

interface FrameSnapshot {
  mediaTime: number;
  bitmapPromise: Promise<ImageBitmap>;
}

function createFrameFromBitmap(
  bitmap: ImageBitmap,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  delayMs: number,
  index: number,
): Promise<Frame> {
  return new Promise((resolve, reject) => {
    ctx.drawImage(bitmap, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error(`导出第 ${index} 帧失败`)); return; }
      const frameFile = new File([blob], `frame_${index}.png`, { type: 'image/png' });
      resolve({
        id: Math.random().toString(36).slice(2, 11),
        file: frameFile,
        previewUrl: URL.createObjectURL(blob),
        delay: delayMs,
        width: canvas.width,
        height: canvas.height,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rotation: 0,
        fileSize: blob.size,
        fileType: 'MP4'
      });
    }, 'image/png');
  });
}

async function buildFramesFromSnapshots(
  snapshots: FrameSnapshot[],
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): Promise<Frame[]> {
  const frames: Frame[] = [];

  for (let i = 0; i < snapshots.length; i++) {
    const bitmap = await snapshots[i].bitmapPromise;

    const nextMediaTime = i + 1 < snapshots.length
      ? snapshots[i + 1].mediaTime
      : snapshots[i].mediaTime + 1 / 30;
    const delayMs = Math.max(10, Math.round((nextMediaTime - snapshots[i].mediaTime) * 1000));

    const frameData = await createFrameFromBitmap(bitmap, canvas, ctx, delayMs, i);
    bitmap.close();
    frames.push(frameData);
  }

  return frames;
}

function captureViaVideoFrameCallback(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): Promise<FrameSnapshot[]> {
  return new Promise((resolve, reject) => {
    const snapshots: FrameSnapshot[] = [];
    let lastMediaTime = -1;

    const handleFrame: VideoFrameRequestCallback = (_now, metadata) => {
      if (Math.abs(metadata.mediaTime - lastMediaTime) < 0.001) {
        video.requestVideoFrameCallback(handleFrame);
        return;
      }
      lastMediaTime = metadata.mediaTime;

      ctx.drawImage(video, 0, 0);
      snapshots.push({
        mediaTime: metadata.mediaTime,
        bitmapPromise: createImageBitmap(canvas),
      });
      video.requestVideoFrameCallback(handleFrame);
    };

    video.onended = () => resolve(snapshots);
    video.onerror = () => reject(new Error('视频播放失败'));

    video.requestVideoFrameCallback(handleFrame);
    video.play().catch(reject);
  });
}

function captureViaAnimationFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): Promise<FrameSnapshot[]> {
  return new Promise((resolve, reject) => {
    const snapshots: FrameSnapshot[] = [];
    let lastTime = -1;
    let frameId = 0;

    const loop = () => {
      if (video.ended) {
        resolve(snapshots);
        return;
      }

      const t = video.currentTime;
      if (t !== lastTime && video.readyState >= 2) {
        lastTime = t;

        ctx.drawImage(video, 0, 0);
        snapshots.push({
          mediaTime: t,
          bitmapPromise: createImageBitmap(canvas),
        });
      }

      frameId = requestAnimationFrame(loop);
    };

    const cleanup = () => {
      cancelAnimationFrame(frameId);
      resolve(snapshots);
    };

    video.onended = cleanup;
    video.onerror = () => {
      cancelAnimationFrame(frameId);
      reject(new Error('视频播放失败'));
    };

    loop();
    video.play().catch(reject);
  });
}

export function isMP4Video(file: File): boolean {
  return file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
}

export async function parseMP4(file: File): Promise<Frame[]> {
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;

  const url = URL.createObjectURL(file);
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('无法加载视频文件'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 Canvas 上下文');

  let snapshots: FrameSnapshot[];

  try {
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      snapshots = await captureViaVideoFrameCallback(video, canvas, ctx);
    } else {
      snapshots = await captureViaAnimationFrame(video, canvas, ctx);
    }
  } finally {
    URL.revokeObjectURL(url);
  }

  if (snapshots.length === 0) {
    throw new Error('未能从视频中提取到任何帧');
  }

  return buildFramesFromSnapshots(snapshots, canvas, ctx);
}
