
function uint24(num: number) {
  return new Uint8Array([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff]);
}

function uint32(num: number) {
  return new Uint8Array([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, (num >> 24) & 0xff]);
}

function parseWebP(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) throw new Error('Buffer too small for WebP');
  const riffHeader = String.fromCharCode(...bytes.slice(0, 4));
  const webpHeader = String.fromCharCode(...bytes.slice(8, 12));
  if (riffHeader !== 'RIFF' || webpHeader !== 'WEBP') throw new Error('Not a valid WebP file');
  const chunks: { type: string; data: Uint8Array }[] = [];
  let offset = 12; // Skip RIFF header (12 bytes)

  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) break;
    const type = String.fromCharCode(...bytes.slice(offset, offset + 4));
    const size = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
    
    if (offset + 8 + size > bytes.length) break;
    const data = bytes.slice(offset + 8, offset + 8 + size);
    offset += 8 + size;
    // Padding byte if size is odd
    if (size % 2 !== 0) offset++; 

    chunks.push({ type, data });
  }
  return chunks;
}

export async function assembleWebP(frames: { image: Blob; duration: number }[], width: number, height: number): Promise<Blob> {
  if (!frames.length) throw new Error('No frames provided for WebP assembly');
  if (width <= 0 || height <= 0) throw new Error(`Invalid dimensions: ${width}x${height}`);

  const parts: Uint8Array[] = [];

  // 1. VP8X Chunk (Extended WebP Header)
  const vp8xData = new Uint8Array(10);
  vp8xData[0] = 0x12; 
  // Canvas Size
  const wMinus1 = width - 1;
  const hMinus1 = height - 1;
  vp8xData.set(uint24(wMinus1), 4);
  vp8xData.set(uint24(hMinus1), 7);
  
  parts.push(new TextEncoder().encode('VP8X'));
  parts.push(uint32(10));
  parts.push(vp8xData);

  // 2. ANIM Chunk (Global Animation Control)
  const animData = new Uint8Array(6);
  animData.set([255, 255, 255, 0], 0); // Background Color (BGRA) - Transparent White
  animData.set([0, 0], 4); // Loop Count (0 = infinite)
  
  parts.push(new TextEncoder().encode('ANIM'));
  parts.push(uint32(6));
  parts.push(animData);

  // 3. Process Frames (ANMF Chunks)
  const frameChunks = await Promise.all(frames.map(async (frame) => {
    const arrayBuffer = await frame.image.arrayBuffer();
    const subChunks = parseWebP(arrayBuffer);
    const validChunks = subChunks.filter(c => ['VP8 ', 'VP8L', 'ALPH'].includes(c.type));
    if (validChunks.length === 0) {
      throw new Error(`Frame has no valid VP8/VP8L/ALPH chunks`);
    }
    let payloadSize = 0;
    validChunks.forEach(c => {
      payloadSize += 8 + c.data.length + (c.data.length % 2);
    });
    return { validChunks, payloadSize, duration: frame.duration };
  }));

  const PADDING_BYTE = new Uint8Array([0]);

  for (const { validChunks, payloadSize, duration } of frameChunks) {
    const anmfHeader = new Uint8Array(16);
    anmfHeader.set(uint24(wMinus1), 6);
    anmfHeader.set(uint24(hMinus1), 9);
    anmfHeader.set(uint24(duration), 12);
    anmfHeader[15] = 0x02;

    const anmfSize = 16 + payloadSize;

    parts.push(new TextEncoder().encode('ANMF'));
    parts.push(uint32(anmfSize));
    parts.push(anmfHeader);

    for (const c of validChunks) {
      parts.push(new TextEncoder().encode(c.type));
      parts.push(uint32(c.data.length));
      parts.push(c.data);
      if (c.data.length % 2 !== 0) {
        parts.push(PADDING_BYTE);
      }
    }
  }

  // 4. Combine into RIFF
  let totalSize = 4; // 'WEBP'
  parts.forEach(p => totalSize += p.length);

  const riffHeader = new Uint8Array(12);
  riffHeader.set(new TextEncoder().encode('RIFF'), 0);
  riffHeader.set(uint32(totalSize), 4);
  riffHeader.set(new TextEncoder().encode('WEBP'), 8);

  return new Blob([riffHeader, ...parts] as BlobPart[], { type: 'image/webp' });
}
