import UPNG from 'upng-js';
import type { Frame } from '../types/frame';

export async function parseAPNG(file: File): Promise<Frame[]> {
  const buffer = await file.arrayBuffer();
  const decoded = UPNG.decode(buffer);

  if (!decoded.frames || decoded.frames.length === 0) {
    throw new Error('不是有效的 APNG 动图文件');
  }

  const frameData = UPNG.toRGBA8(decoded);
  const frames: Frame[] = [];

  for (let i = 0; i < frameData.length; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 Canvas 上下文');

    const imageData = new ImageData(
      new Uint8ClampedArray(frameData[i]),
      decoded.width,
      decoded.height
    );
    ctx.putImageData(imageData, 0, 0);

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });

    if (!blob) throw new Error(`为第 ${i} 帧创建图像数据失败`);

    const frameFile = new File([blob], `frame_${i}.png`, { type: 'image/png' });

    frames.push({
      id: Math.random().toString(36).slice(2, 11),
      file: frameFile,
      previewUrl: URL.createObjectURL(blob),
      delay: decoded.frames[i]?.delay || 100,
      width: decoded.width,
      height: decoded.height,
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
      fileSize: blob.size,
      fileType: 'PNG'
    });
  }

  return frames;
}
