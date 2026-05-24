export async function isAnimatedPNG(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer();
  const dataView = new DataView(buffer);

  if (dataView.getUint32(0) !== 0x89504E47 ||
      dataView.getUint32(4) !== 0x0D0A1A0A) {
    return false;
  }

  const maxSearchLength = Math.min(buffer.byteLength, 10000);
  let i = 8;

  while (i < maxSearchLength - 8) {
    const chunkLength = dataView.getUint32(i);
    const chunkType = dataView.getUint32(i + 4);

    if (chunkType === 0x6163544C) {
      return true;
    }
    if (chunkType === 0x49444154) {
      return false;
    }

    i += 12 + chunkLength;
  }

  return false;
}
