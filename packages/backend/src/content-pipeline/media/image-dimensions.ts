/**
 * Read pixel dimensions straight out of an image's header bytes.
 *
 * A media slot accepts PNG, JPEG and WebP, and the backend has no image
 * library to measure them with (`pngjs` is a video-template dependency and
 * only speaks PNG). All three formats declare their size in a fixed,
 * well-documented header, so reading it is a few dozen bytes of arithmetic —
 * cheaper and far more predictable than adding a dependency or spawning
 * ffprobe for a screenshot.
 *
 * Every path returns null rather than throwing on anything it cannot read
 * confidently. The caller treats an unreadable size as "no sourceAspect",
 * never as a failed upload.
 */

export interface PixelDimensions {
  width: number;
  height: number;
}

/** Dimensions of a PNG, JPEG or WebP buffer, or null if unreadable. */
export function readImageDimensions(buffer: Buffer): PixelDimensions | null {
  return (
    readPngDimensions(buffer) ??
    readJpegDimensions(buffer) ??
    readWebpDimensions(buffer)
  );
}

export type SniffedImageFormat = 'png' | 'jpeg' | 'webp';

/**
 * What the bytes actually ARE, independent of what the upload claimed.
 *
 * Multipart uploads carry a client-declared Content-Type, which is trivially
 * spoofed. Each reader above already validates its format's signature before
 * trusting an offset, so identifying the real format costs nothing extra —
 * and lets the caller reject a file whose contents contradict its label.
 *
 * Returns null when the bytes match none of the supported signatures. That
 * is deliberately NOT treated as proof of forgery by the caller: an exotic
 * but legitimate variant can fail to parse, and blocking a real upload is
 * worse than storing a file that will simply fail to render.
 */
export function sniffImageFormat(buffer: Buffer): SniffedImageFormat | null {
  if (readPngDimensions(buffer)) return 'png';
  if (readJpegDimensions(buffer)) return 'jpeg';
  if (readWebpDimensions(buffer)) return 'webp';
  return null;
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/** IHDR is always the first chunk, so the size sits at a fixed offset. */
function readPngDimensions(buffer: Buffer): PixelDimensions | null {
  if (buffer.length < 24) return null;
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return dimensionsOrNull(buffer.readUInt32BE(16), buffer.readUInt32BE(20));
}

/**
 * Walk the JPEG marker chain to the start-of-frame segment.
 *
 * JPEG has no fixed header offset — EXIF, ICC profiles and quantization
 * tables all sit ahead of the frame, and phone cameras emit plenty of them,
 * so the size can be many kilobytes in.
 */
function readJpegDimensions(buffer: Buffer): PixelDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 9 < buffer.length) {
    // Segments may be padded with 0xff fill bytes; skip to the real marker.
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    // Standalone markers (SOI, TEM, RST0-7) carry no length payload.
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    // End-of-image or start-of-scan: entropy-coded data follows and the frame
    // size never appeared, so there is nothing left to find.
    if (marker === 0xd9 || marker === 0xda) return null;

    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;

    // SOF0-SOF15 hold the frame size. DHT (0xc4), JPG (0xc8) and DAC (0xcc)
    // share that marker range but describe tables, not the frame.
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isStartOfFrame) {
      // Within SOF: precision, then height, then width.
      return dimensionsOrNull(
        buffer.readUInt16BE(offset + 7),
        buffer.readUInt16BE(offset + 5),
      );
    }
    offset += 2 + length;
  }
  return null;
}

/**
 * WebP wraps one of three bitstream flavors in a RIFF container, and each
 * stores its size differently. Screenshots exported from a browser are
 * usually VP8L; anything with alpha or animation is VP8X.
 */
function readWebpDimensions(buffer: Buffer): PixelDimensions | null {
  if (buffer.length < 30) return null;
  if (
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return null;
  }

  switch (buffer.toString('ascii', 12, 16)) {
    case 'VP8 ': {
      // Lossy: 3-byte frame tag, then the 0x9d012a sync code, then 14-bit dims.
      if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) {
        return null;
      }
      return dimensionsOrNull(
        buffer.readUInt16LE(26) & 0x3fff,
        buffer.readUInt16LE(28) & 0x3fff,
      );
    }
    case 'VP8L': {
      // Lossless: 0x2f signature, then width-1 and height-1 in 14 bits each.
      if (buffer[20] !== 0x2f) return null;
      const packed = buffer.readUInt32LE(21);
      return dimensionsOrNull(
        (packed & 0x3fff) + 1,
        ((packed >> 14) & 0x3fff) + 1,
      );
    }
    case 'VP8X': {
      // Extended: canvas size as two 24-bit little-endian minus-ones.
      return dimensionsOrNull(
        buffer.readUIntLE(24, 3) + 1,
        buffer.readUIntLE(27, 3) + 1,
      );
    }
    default:
      return null;
  }
}

function dimensionsOrNull(
  width: number,
  height: number,
): PixelDimensions | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}
