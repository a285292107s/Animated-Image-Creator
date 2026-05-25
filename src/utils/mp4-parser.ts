import { createFile } from 'mp4box';
import type { Sample, Track, Movie } from 'mp4box';
import type { Frame } from '../types/frame';

function createFrameFromCanvas(
  canvas: HTMLCanvasElement,
  delayMs: number,
  index: number
): Promise<Frame> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
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

function extractCodecDescription(firstSample: Sample): ArrayBuffer | undefined {
  const desc = firstSample?.description;
  if (!desc) return undefined;

  const box = desc as { boxes?: Array<{ type: string; data?: Uint8Array; write?: (stream: unknown) => void }> };
  if (!box.boxes) return undefined;

  for (const subBox of box.boxes) {
    if (subBox.type === 'avcC' || subBox.type === 'hvcC') {
      if (subBox.data) {
        const buf = subBox.data.buffer.slice(0);
        return buf as ArrayBuffer;
      }
    }
  }
  return undefined;
}

async function decodeViaWebCodecs(
  track: Track,
  samples: Sample[],
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): Promise<Frame[]> {
  const codecString = track.codec || '';
  const description = extractCodecDescription(samples[0]);

  const config: VideoDecoderConfig = {
    codec: codecString,
  };
  if (description) {
    config.description = description;
  }

  const support = await VideoDecoder.isConfigSupported(config);
  if (!support.supported) {
    throw new Error(`不支持的视频编码格式：${codecString}`);
  }

  const frames: Frame[] = [];
  const videoFrames: VideoFrame[] = [];

  const decoder = new VideoDecoder({
    output(frame: VideoFrame) {
      videoFrames.push(frame);
    },
    error(e: Error) {
      throw e;
    }
  });

  decoder.configure(config);

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: sample.dts,
      duration: sample.duration,
      data: sample.data!,
    });
    decoder.decode(chunk);
  }

  await decoder.flush();

  const timescale = track.timescale || 1000;

  for (let i = 0; i < videoFrames.length; i++) {
    const frame = videoFrames[i];
    const sampleIdx = Math.min(i, samples.length - 1);
    const sampleDuration = samples[sampleIdx].duration || 0;
    const delayMs = Math.max(10, Math.round(((sampleDuration / timescale) * 1000)));

    const w = frame.displayWidth;
    const h = frame.displayHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.drawImage(frame, 0, 0);
    frame.close();

    const frameData = await createFrameFromCanvas(canvas, delayMs, i);
    frames.push(frameData);
  }

  decoder.close();
  return frames;
}

type MP4BoxBuffer = ArrayBuffer & { fileStart: number };

export function isMP4Video(file: File): boolean {
  return file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
}

export async function parseMP4(file: File): Promise<Frame[]> {
  if (!('VideoDecoder' in window)) {
    throw new Error('当前浏览器不支持 WebCodecs 视频解码');
  }

  const buffer = await file.arrayBuffer();

  const mp4Buffer = buffer as unknown as MP4BoxBuffer;
  mp4Buffer.fileStart = 0;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 Canvas 上下文');

  return new Promise((resolve, reject) => {
    const mp4 = createFile();

    let track: Track | undefined;
    const collectedSamples: Sample[] = [];

    mp4.onReady = (info: Movie) => {
      const videoTrack = info.videoTracks?.[0];
      if (!videoTrack) {
        reject(new Error('MP4 文件中未找到视频轨道'));
        return;
      }
      track = videoTrack;
      mp4.setExtractionOptions(videoTrack.id, undefined, { nbSamples: videoTrack.nb_samples ?? 1 });
    };

    mp4.onSamples = (_id: number, _user: unknown, chunks: Sample[]) => {
      collectedSamples.push(...chunks);
      if (track && collectedSamples.length >= (track.nb_samples ?? 0)) {
        decodeViaWebCodecs(track, collectedSamples, canvas, ctx)
          .then(resolve)
          .catch((err: unknown) => {
            reject(new Error(`MP4 解码错误：${err instanceof Error ? err.message : String(err)}`));
          });
      }
    };

    mp4.onError = (_module: string, message: string) => {
      reject(new Error(`MP4 解析错误：${message}`));
    };

    mp4.appendBuffer(mp4Buffer);
    mp4.flush();
  });
}
